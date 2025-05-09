import cv2
import numpy as np
import glob
import os
import time
import threading
from queue import Queue
from pydrive.auth import GoogleAuth
from pydrive.drive import GoogleDrive
import qrcode
from PIL import Image
import onnxruntime as ort

# --- CONFIGURATION ---
W, H = 1920, 1080
PREVIEW_SCALE = 0.5
CAM_INDEX = 1
DRIVE_FOLDER_TITLE = 'Image'
COUNTDOWN_SEC = 5
THUMB_W = 120
THUMB_H = int(THUMB_W * H / W)
PADDING = 10
START_X = 10
# Buffer settings
FRAME_BUFFER_SIZE = 3  # Number of frames to buffer

# --- INITIALIZE WEBCAM & WINDOW ---
def setup_camera(cam_index):
    cap = cv2.VideoCapture(cam_index, cv2.CAP_DSHOW)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, W)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, H)
    # Set buffer size to minimum to reduce latency
    cap.set(cv2.CAP_PROP_BUFFERSIZE, FRAME_BUFFER_SIZE)
    # Set high FPS if available
    cap.set(cv2.CAP_PROP_FPS, 30)
    # Set autofocus off for faster frame processing
    cap.set(cv2.CAP_PROP_AUTOFOCUS, 0)
    # Force using hardware acceleration if available
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
    
    if not cap.isOpened(): 
        raise RuntimeError('Cannot open webcam')
    
    actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    actual_fps = cap.get(cv2.CAP_PROP_FPS)
    print(f"Camera initialized: {actual_w}x{actual_h} @ {actual_fps}fps")
    
    return cap, actual_w, actual_h

cap, actual_w, actual_h = setup_camera(CAM_INDEX)
if (actual_w, actual_h) != (W, H): 
    W, H = actual_w, actual_h
    
# Create resizable window
cv2.namedWindow('Photo Booth', cv2.WINDOW_NORMAL)
# Start in windowed mode
fullscreen = False
cv2.setWindowProperty('Photo Booth', cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_NORMAL)

# --- GOOGLE DRIVE SETUP ---
def setup_drive():
    ga = GoogleAuth()
    ga.LocalWebserverAuth()
    drive = GoogleDrive(ga)
    folder_q = f"title='{DRIVE_FOLDER_TITLE}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    folders = drive.ListFile({'q': folder_q}).GetList()
    if folders: 
        folder_id = folders[0]['id']
    else:
        f = drive.CreateFile({'title': DRIVE_FOLDER_TITLE, 'mimeType': 'application/vnd.google-apps.folder'})
        f.Upload()
        folder_id = f['id']
    return drive, folder_id

# Initialize drive in a separate thread to avoid blocking the main loop
drive_queue = Queue()
def init_drive_thread():
    try:
        drive, folder_id = setup_drive()
        drive_queue.put((drive, folder_id))
    except Exception as e:
        print(f"Drive initialization error: {e}")
        drive_queue.put((None, None))

threading.Thread(target=init_drive_thread, daemon=True).start()

def upload_file(path, drive, folder_id):
    try:
        f = drive.CreateFile({'title': os.path.basename(path), 'parents': [{'id': folder_id}]})
        f.SetContentFile(path)
        f.Upload()
        f.InsertPermission({'type': 'anyone','value': 'anyone','role': 'reader'})
        return f['alternateLink']
    except Exception as e:
        print('Upload error:', e)
        return None

# Thread for asynchronous file upload
def upload_thread(path, result_queue):
    try:
        if 'drive' not in globals():
            global drive, folder_id
            drive, folder_id = drive_queue.get()
            if drive is None:
                result_queue.put(None)
                return
                
        link = upload_file(path, drive, folder_id)
        result_queue.put(link)
    except Exception as e:
        print(f"Upload thread error: {e}")
        result_queue.put(None)

# --- QR CODE GENERATOR ---
def make_qr(link, size=180):
    qr = qrcode.QRCode(border=1)
    qr.add_data(link)
    qr.make(fit=True)
    img = qr.make_image(fill_color='black',back_color='white').convert('RGB')
    res = getattr(Image, 'Resampling', Image).LANCZOS
    return img.resize((size, size), res)

# --- LOAD BACKGROUNDS ---
def load_backgrounds(bg_folder='backgrounds'):
    bg_paths = sorted(glob.glob(os.path.join(bg_folder,'*')))
    backgrounds = []
    for p in bg_paths:
        if not p.lower().endswith(('.jpg','.jpeg','.png')): 
            continue
        img = cv2.imread(p)
        if img is None: 
            continue
        try: 
            backgrounds.append(cv2.resize(img, (W,H)))
        except: 
            continue
    if not backgrounds: 
        backgrounds = [np.full((H,W,3),128,np.uint8)]
    return backgrounds

backgrounds = load_backgrounds()
bg_index = 0

# Pre-compute small backgrounds
small_W, small_H = int(W*PREVIEW_SCALE), int(H*PREVIEW_SCALE)
bg_small = [cv2.resize(bg,(small_W,small_H)) for bg in backgrounds]

# --- MODEL SETUP (MODNet) ---
def load_modnet(model_path='models/modnet.onnx'):
    if not os.path.isfile(model_path): 
        raise FileNotFoundError(f'Missing {model_path}')
    
    # Try to use GPU if available
    providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
    try:
        sess = ort.InferenceSession(model_path, providers=providers)
        print(f"Using provider: {sess.get_providers()[0]}")
    except:
        sess = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
        print("Using CPU provider")
    
    return sess, sess.get_inputs()[0].name

mod_sess, mod_input = load_modnet()

# --- PREPROCESSING & SEGMENTATION ---
clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))

def preprocess(f):
    hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
    hsv[:,:,2] = clahe.apply(hsv[:,:,2])
    bgr = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
    tbl = ((np.arange(256)/255.0)**(1/1.2)*255).astype('uint8')
    return cv2.LUT(bgr, tbl)

# Processed frame cache to avoid redundant processing
last_frame_time = 0
last_processed_frame = None
process_interval = 1/15  # Process at most 15 frames per second for previews

def segment_and_composite(frame, bg, high_quality=False):
    global last_frame_time, last_processed_frame
    
    current_time = time.time()
    
    # If this is a high-quality request or enough time has passed, process the frame
    if high_quality or (current_time - last_frame_time > process_interval):
        f0 = preprocess(frame)
        
        # Use different resolutions for preview vs final capture
        target_size = 512 if high_quality else 256
        
        inp = cv2.resize(f0, (target_size, target_size))
        inp = cv2.cvtColor(inp, cv2.COLOR_BGR2RGB)/255.0
        inp = inp.astype(np.float32).transpose(2,0,1)[None]
        
        matte = mod_sess.run(None, {mod_input: inp})[0][0,0]
        matte = cv2.resize(matte, (frame.shape[1], frame.shape[0]), cv2.INTER_LINEAR)
        
        # More smoothing for preview, less for high quality
        blur_size = 11 if not high_quality else 21
        matte = cv2.GaussianBlur(matte, (blur_size, blur_size), 0)
        
        mask = matte[:,:,None]
        fg = frame.astype(np.float32) * mask
        bb = bg.astype(np.float32) * (1-mask)
        
        result = np.clip(fg+bb, 0, 255).astype(np.uint8)
        
        if not high_quality:
            last_processed_frame = result
            last_frame_time = current_time
            
        return result
    else:
        # Return the cached result if we have one and not enough time has passed
        return last_processed_frame if last_processed_frame is not None else frame

# --- THREADED FRAME GRABBER ---
frame_queue = Queue(maxsize=10)
stop_event = threading.Event()

def frame_grabber(cap, queue, stop_event):
    while not stop_event.is_set():
        ret, frame = cap.read()
        if not ret:
            break
            
        # Only add to queue if it's not full to avoid backlog
        if not queue.full():
            queue.put(frame)
        else:
            # Skip frame if queue is full
            queue.get()  # Remove oldest frame
            queue.put(frame)  # Add new frame
            
        # Small sleep to reduce CPU usage
        time.sleep(0.001)

# Start frame grabber thread
grabber_thread = threading.Thread(target=frame_grabber, args=(cap, frame_queue, stop_event), daemon=True)
grabber_thread.start()

# --- MAIN LOOP ---
state = 'preview'
capture_deadline = None
raw_frame = None
captured_img = None
upload_queue = Queue()
qr_image = None

# For FPS calculation
frame_times = []
last_fps_update = time.time()
current_fps = 0

try:
    while True:
        # FPS calculation
        now = time.time()
        frame_times.append(now)
        frame_times = [t for t in frame_times if now - t < 1.0]  # Keep only last second
        if now - last_fps_update > 0.5:  # Update FPS every half second
            current_fps = len(frame_times)
            last_fps_update = now
        
        # Frame acquisition with timeout
        try:
            frame = frame_queue.get(timeout=0.1)
            frame = cv2.resize(frame, (W, H))
        except:
            # If no frame is available, continue the loop
            continue
            
        if state == 'preview':
            # Segmentation at lower res for speed
            small_f = cv2.resize(frame, (small_W, small_H))
            
            # Check if we already have a background
            if bg_index >= len(backgrounds):
                bg_index = 0
                
            small_comp = segment_and_composite(small_f, bg_small[bg_index])
            display = cv2.resize(small_comp, (W, H), cv2.INTER_LINEAR)
            
            # Countdown overlay
            if capture_deadline:
                rem = int(capture_deadline - now) + 1
                if rem <= 0:
                    raw_frame = frame.copy()
                    state = 'processing'
                    capture_deadline = None
                else:
                    cv2.putText(display, f"SNAP IN {rem}", (30, 100), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 0, 255), 4)
            
            # Thumbnails
            for i, bg in enumerate(backgrounds):
                if i >= 10:  # Limit to 10 backgrounds for keyboard selection
                    break
                x = START_X + i * (THUMB_W + PADDING)
                y = H - THUMB_H - PADDING
                col = (0, 255, 0) if i == bg_index else (255, 255, 255)
                cv2.rectangle(display, (x-2, y-2), (x+THUMB_W+2, y+THUMB_H+2), col, 2)
                display[y:y+THUMB_H, x:x+THUMB_W] = bg[0:THUMB_H, 0:THUMB_W]
                cv2.putText(display, str(i), (x+THUMB_W//2-10, y-5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, col, 2)
            
            # Display FPS
            cv2.putText(display, f"FPS: {current_fps}", (W-150, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            cv2.imshow('Photo Booth', display)
            
        elif state == 'processing':
            print("Processing high-quality image...")
            # Show a processing message
            processing_img = np.zeros((H, W, 3), dtype=np.uint8)
            cv2.putText(processing_img, "PROCESSING...", (W//3, H//2), 
                        cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 3)
            cv2.imshow('Photo Booth', processing_img)
            cv2.waitKey(1)  # Update display
            
            # Process the image in high quality
            comp = segment_and_composite(raw_frame, backgrounds[bg_index], high_quality=True)
            fname = f"capture_{int(time.time())}.jpg"
            cv2.imwrite(fname, comp)
            
            # Start upload in background thread
            threading.Thread(target=upload_thread, args=(fname, upload_queue), daemon=True).start()
            
            captured_img = comp
            state = 'review'
            
        elif state == 'review':
            # Check if upload is complete
            if qr_image is None and not upload_queue.empty():
                link = upload_queue.get()
                if link:
                    qr = make_qr(link)
                    qr_np = cv2.cvtColor(np.array(qr), cv2.COLOR_RGB2BGR)
                    hq, wq = qr_np.shape[:2]
                    
                    # Create a copy to avoid modifying the original
                    display_img = captured_img.copy()
                    display_img[-hq-20:-20, -wq-20:-20] = qr_np
                    
                    # Add link text
                    cv2.putText(display_img, "Scan QR to download", (W-wq-170, H-hq-30), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                    
                    captured_img = display_img
                    qr_image = True  # Mark as processed
            
            # Add instructions
            display_img = captured_img.copy()
            cv2.putText(display_img, "Press 'N' for new photo", (30, 50), 
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
            
            cv2.imshow('Photo Booth', display_img)

        key = cv2.waitKey(1) & 0xFF
        
        # Toggle fullscreen/windowed
        if key == ord('f'):
            fullscreen = not fullscreen
            if fullscreen:
                cv2.setWindowProperty('Photo Booth', cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
            else:
                cv2.setWindowProperty('Photo Booth', cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_NORMAL)
        
        if key == 27:  # ESC key
            break
            
        if state == 'preview':
            if ord('0') <= key <= ord('9'):
                new_index = key - ord('0')
                if new_index < len(backgrounds):
                    bg_index = new_index
            elif key == 13 and not capture_deadline:  # Enter key
                capture_deadline = now + COUNTDOWN_SEC
                
        elif state == 'review' and key in (ord('n'), ord('N')):
            state = 'preview'
            qr_image = None  # Reset QR image flag
            
except KeyboardInterrupt:
    print("Program interrupted by user")
finally:
    # Clean up
    stop_event.set()
    if grabber_thread.is_alive():
        grabber_thread.join(timeout=1.0)
    cap.release()
    cv2.destroyAllWindows()
    print("Application closed successfully")
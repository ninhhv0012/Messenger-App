import cv2
import numpy as np
import onnxruntime as ort

def remove_bg_modnet_onnx(input_path, output_path, onnx_path):
    # 1. Load ONNX model
    sess = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
    input_name = sess.get_inputs()[0].name
    
    # 2. Đọc và chuẩn hoá ảnh
    img = cv2.imread(input_path)
    h, w = img.shape[:2]
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    
    # 3. Resize về kích thước model yêu cầu (ví dụ 512x512)
    #    hoặc theo đúng size training của model bạn đã export
    target_size = (512, 512)
    im_resized = cv2.resize(rgb, target_size, interpolation=cv2.INTER_LINEAR)
    
    # 4. Tạo tensor [1, 3, H, W], normalize nếu cần
    inp = np.transpose(im_resized, (2, 0, 1))[None, :, :, :].astype(np.float32)
    
    # 5. Inference
    matte_pred = sess.run(None, {input_name: inp})[0]  # shape (1,1,512,512)
    matte = matte_pred[0,0,:,:]
    
    # 6. Resize matte về kích thước gốc
    matte = cv2.resize(matte, (w, h), interpolation=cv2.INTER_LINEAR)
    matte = np.clip(matte, 0, 1)[:, :, None]
    
    # 7. Kết hợp FG/BG (ở đây để nền trắng)
    fg = img.astype(np.float32) * matte
    bg = np.ones_like(img, np.float32) * 255 * (1 - matte)
    out = np.uint8(fg + bg)
    
    # 8. Lưu kết quả
    cv2.imwrite(output_path, out)
    
if __name__ == "__main__":
    remove_bg_modnet_onnx(
        input_path="test/anh2.JPG",
        output_path="output_modnet_onnx.png",
        onnx_path="models/modnet.onnx"
    )

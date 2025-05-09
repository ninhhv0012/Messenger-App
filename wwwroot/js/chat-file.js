// Biến toàn cục để lưu file đã chọn
let selectedFile = null;

// Khởi tạo xử lý file
function initFileHandling() {
    // Xử lý khi người dùng chọn file
    $("#fileInput").change(handleFileSelection);

    // Xử lý khi người dùng click nút xóa file
    $("#removeFile").click(clearFileSelection);

    // Xử lý sự kiện submit form khi có file
    $("#btnSend").click(function () {
        if (selectedFile) {
            uploadFile();
            return false;
        }
    });
}

// Xử lý khi người dùng chọn file
function handleFileSelection() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files || fileInput.files.length === 0) {
        clearFileSelection();
        return;
    }

    selectedFile = fileInput.files[0];

    // Hiển thị thông tin file
    $("#selectedFileName").text(selectedFile.name);
    $("#fileType").text(selectedFile.type || "Không xác định");
    $("#fileSize").text(formatFileSize(selectedFile.size));

    // Hiển thị preview
    if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function (e) {
            $("#previewImg").attr('src', e.target.result);
            $("#imagePreview").show();
            $("#fileInfo").hide();
        };
        reader.readAsDataURL(selectedFile);
    } else {
        $("#imagePreview").hide();
        $("#fileInfo").show();
    }

    // Hiển thị khu vực xem trước
    $("#filePreviewArea").show();
}

// Xóa file đã chọn
function clearFileSelection() {
    selectedFile = null;
    $("#fileInput").val('');
    $("#filePreviewArea").hide();
    $("#previewImg").attr('src', '');
}

// Định dạng kích thước file
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Tải lên file
function uploadFile() {
    if (!selectedFile) return;

    const chatId = $("#chatId").val();
    const content = $("#txtMessage").val().trim();

    // Tạo đối tượng FormData để gửi file
    const formData = new FormData();
    formData.append('chatId', chatId);
    formData.append('file', selectedFile);

    if (content) {
        formData.append('content', content);
    }

    // Disable input trong quá trình upload
    $("#fileInput").prop('disabled', true);
    $("#txtMessage").prop('disabled', true);
    $("#btnSend").prop('disabled', true).text('Đang tải...');

    // Gửi request AJAX
    $.ajax({
        url: '/Chat/UploadFile',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function (response) {
            console.log('File uploaded successfully:', response);
            $("#txtMessage").val('').focus();
            clearFileSelection();
        },
        error: function (xhr, status, error) {
            console.error('Error uploading file:', error);
            alert('Không thể tải lên file. Vui lòng thử lại.');
        },
        complete: function () {
            // Re-enable input sau khi upload xong
            $("#fileInput").prop('disabled', false);
            $("#txtMessage").prop('disabled', false);
            $("#btnSend").prop('disabled', false).text('Gửi');
        }
    });
}
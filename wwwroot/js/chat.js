"use strict";

$(function () {
    var chatId = $('#chatId').val();
    var connection = new signalR.HubConnectionBuilder()
        .withUrl('/chathub?chatId=' + chatId)
        .build();

    connection.on('ReceiveMessage', function (msg) {
        console.log('RECV', msg);
        appendMessage(msg);
    });

    connection.start()
        .then(() => {
            console.log('Connected, joining group', chatId);
            return connection.invoke('JoinGroup', 'chat_' + chatId);
        })
        .then(() => console.log('Joined group'))
        .catch(err => console.error('SignalR error', err));
    connection.on('ReceiveMessage', msg => {
        console.log('Received via SignalR:', msg);
        appendMessage(msg);
    });


    $('#txtMessage').on('input', function () {
        $('#btnSend').prop('disabled', $(this).val().trim() === '');
    });

    $('#btnSend').click(function () {
        var content = $('#txtMessage').val().trim();
        if (!content) return; // prevent empty send
        $.post('/Chat/SendMessage', { chatId: chatId, content: content });
        $('#txtMessage').val('').trigger('input');
    });

    // file upload: send immediately on change
    $('#fileInput').change(function () {
        var file = this.files[0];
        if (!file) return;
        var form = new FormData();
        form.append('chatId', chatId);
        form.append('file', file);
        fetch('/Chat/UploadFile', { method: 'POST', body: form })
            .then(() => console.log('File sent'))
            .catch(console.error);
    });
});

function appendMessage(msg) {
    var align = (msg.SenderId == currentUserId) ? 'justify-content-end' : 'justify-content-start';
    var bubble = $('<div>').addClass('d-flex ' + align + ' mb-2 msg-item').attr('data-timestamp', msg.Timestamp);
    var inner = $('<div>').addClass('p-2 rounded bg-light').css('max-width', '70%');
    inner.append($('<div>').html('<small><strong>' + msg.SenderUsername + '</strong></small>'));

    if (msg.MessageType === 'Image' && msg.Content) {
        inner.append($('<img>').attr('src', msg.Content).addClass('img-fluid'));
    }
    else if (msg.MessageType === 'File' && msg.Content) {
        inner.append($('<a>').attr('href', msg.Content).attr('download', '').text('Tải file'));
    }
    else {
        inner.append($('<div>').text(msg.Content));
    }

    bubble.append(inner);
    $('#messageList').append(bubble);
    $('#detailContainer').scrollTop($('#detailContainer')[0].scrollHeight);
}
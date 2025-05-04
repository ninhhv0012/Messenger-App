
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Messenger_App.Models
{
    public class Document
    {
        public int FileId { get; set; }
        public int? MessageId { get; set; }
        public Message? Message { get; set; }

        public string FileName { get; set; } = default!;
        public string FilePath { get; set; } = default!;
        public string? FileType { get; set; }
        public long? FileSize { get; set; }

        public int? UploadedBy { get; set; }
        public User? Uploader { get; set; }
        public DateTime UploadedAt { get; set; }
    }
}

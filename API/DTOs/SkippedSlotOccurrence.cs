// File: SkippedSlotOccurrence.cs
// Purpose: One day the create-slots request skipped because a slot already existed there.
// Author: IT23215856

namespace API.DTOs
{
    public class SkippedSlotOccurrence
    {
        // UTC start of the slot that would have been created, so the client can show it in local time
        public DateTime StartTime { get; set; }

        public string Reason { get; set; } = string.Empty;
    }
}

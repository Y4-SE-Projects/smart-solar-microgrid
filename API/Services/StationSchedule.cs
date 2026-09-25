// File: StationSchedule.cs
// Purpose: Reads a station's operating hours, e.g. "06:00-22:00", from its schedule text.
// Author: IT23215856

using System.Text.RegularExpressions;

namespace API.Services
{
    public class StationSchedule
    {
        // Finds the first "HH:mm-HH:mm" window, so older text such as "Mon-Sun 06:00-22:00" still reads
        private static readonly Regex HoursFormat = new(@"(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})");

        public TimeSpan Opens { get; }

        public TimeSpan Closes { get; }

        private StationSchedule(TimeSpan opens, TimeSpan closes)
        {
            // Only built through TryParse, so every instance is already valid
            Opens = opens;
            Closes = closes;
        }

        // Reads the opening and closing time, rejecting text with no time window or one that closes before it opens
        public static bool TryParse(string? text, out StationSchedule? schedule)
        {
            schedule = null;
            var match = HoursFormat.Match(text ?? string.Empty);
            if (!match.Success)
            {
                return false;
            }

            if (!TimeSpan.TryParseExact(match.Groups[1].Value, @"hh\:mm", null, out var opens) ||
                !TimeSpan.TryParseExact(match.Groups[2].Value, @"hh\:mm", null, out var closes) ||
                opens >= closes)
            {
                return false;
            }

            schedule = new StationSchedule(opens, closes);
            return true;
        }

        // True when the whole time window sits inside opening hours
        public bool Covers(TimeSpan start, TimeSpan end)
        {
            return start >= Opens && end <= Closes;
        }

        // Opening hours as "06:00-22:00", for error messages
        public string HoursLabel()
        {
            return $"{Opens:hh\\:mm}-{Closes:hh\\:mm}";
        }
    }
}

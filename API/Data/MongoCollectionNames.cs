/* File: MongoCollectionNames.cs
 * Purpose: Single source of truth for the 4 required MongoDB collection name strings.
 * Author: IT23218512
 */
 
namespace API.Data
{
    public static class MongoCollectionNames
    {
        // Backing collection for the rubric's "User's detail" requirement.
        public const string Users = "Users";

        public const string SolarStationInfo = "SolarStationInfo";

        public const string EnergyBookingSlots = "EnergyBookingSlots";

        // Backing collection for the rubric's "Energy Reservation" requirement.
        public const string EnergyReservation = "EnergyReservation";
    }
}
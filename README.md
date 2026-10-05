
# Smart Solar Microgrid Trading System
 
A client-server application that enables solar prosumers to trade energy through microgrid nodes, with backoffice staff and grid operators managing the platform.
 
The system follows a **FAT service architecture**: a central C# Web API holds all business logic and data access, while a web application and a native Android application act purely as user interface clients communicating over REST.
 


## Overview
 
The Smart Solar Microgrid Trading System connects three types of users around a shared network of solar microgrid nodes:
 
- **Backoffice officers** register and manage microgrid nodes, oversee user accounts, and handle system administration through the web application.
- **Grid Operators** monitor energy trading activity, manage reservations, and verify prosumer transactions using both the web and mobile applications.
- **Solar Prosumers** (property owners with solar panel arrays) reserve energy drop-off/charging slots, track their bookings, and complete trades using the mobile application.
All data and business logic are centralized in a single Web API. Neither client application accesses the database directly or contains business rules — they exist solely to present data and collect user input.
 
## Architecture
 
```
                         ┌─────────────┐
                         │   MongoDB   │
                         │  (NoSQL DB) │
                         └──────┬──────┘
                                │
                       ┌────────┴─────────┐
                       │   Web Service    │
                       │  (C# Web API)    │
                       │  hosted on IIS   │
                       │                  │
                       │  ALL business    │
                       │  logic lives     │
                       │  here (FAT       │
                       │  service pattern)│
                       └───┬──────────┬───┘
                REST/JSON  │          │  REST/JSON
                 (HTTP)    │          │   (HTTP)
              ┌────────────┘          └───────────────┐
              │                                       │
      ┌───────┴──────────┐                  ┌─────────┴─────────┐
      │  Mobile App      │                  │   Web App         │
      │  Native Android  │                  │  Bootstrap/       │
      │  + SQLite        │                  │  Tailwind/React   │
      │  (Prosumer +     │                  │  (Backoffice +    │
      │   Grid Operator) │                  │   Grid Operator)  │
      └──────────────────┘                  └───────────────────┘
```

**Architectural principles followed:**
 
- **Client-server architecture** with strict separation between clients and the service layer.
- **N-tier structure**: Presentation tier (Web app, Android app) → Logic tier (Web API) → Data tier (MongoDB).
- **RESTful communication** — clients interact with the API exclusively via HTTP methods (GET, POST, PUT, DELETE).
- **FAT service pattern** — validation and business rules (e.g. reservation windows, deactivation checks) are enforced only inside the API, never duplicated in client code.
- **Local persistence on Android** — SQLite is used only for caching/session data on the mobile client, never as a substitute for the central data store.

## Tech Stack
 
| Layer | Technology |
|---|---|
| Web Service / API | C# ASP.NET Web API |
| API Hosting | Windows IIS Server |
| Database | MongoDB (NoSQL) |
| Web Application | Tailwind CSS & React + Vite |
| Mobile Application | Native Android (Java) |
| Mobile Local Storage | SQLite |
| Mobile Maps | Google Maps API |
| Mobile Extras | QR code generation & scanning |
| Version Control | Git & GitHub |

## Project Structure
 
```
smart-solar-microgrid/
├── API/
│   ├── Controllers/
│   ├── Data/
│   ├── DTOs/
│   ├── Models/
│   ├── Properties/
│   ├── Services/
│   └── Settings/
├── Web/
│   ├── public/
│   └── src/
│       ├── components/
│       │   ├── common/
│       │   ├── layout/
│       │   ├── prosumers/
│       │   ├── reservations/
│       │   ├── slots/
│       │   ├── staff/
│       │   └── stations/
│       ├── constants/
│       ├── context/
│       ├── pages/
│       ├── router/
│       ├── services/
│       └── utils/
└── Mobile/
    ├── gradle/
    │   └── wrapper/
    └── app/
        └── src/
            ├── androidTest/
            ├── test/
            └── main/
                ├── assets/
                ├── java/com/example/smart_solar_mobile/
                │   ├── activities/
                │   ├── adapters/
                │   ├── db/
                │   ├── models/
                │   ├── network/
                │   ├── utils/
                │   └── views/
                └── res/
                    ├── animator/
                    ├── color/
                    ├── drawable/
                    ├── layout/
                    ├── mipmap-anydpi-v26/
                    ├── mipmap-hdpi/
                    ├── mipmap-mdpi/
                    ├── mipmap-xhdpi/
                    ├── mipmap-xxhdpi/
                    ├── mipmap-xxxhdpi/
                    ├── values/
                    ├── values-night/
                    └── xml/
```

## User Roles
 
| Role | Platform Access | Responsibilities |
|---|---|---|
| **Backoffice** | Web only | System administration, user management, microgrid node registration, schedule maintenance |
| **Grid Operator** | Web + Mobile | Update battery slot availability, monitor and manage reservations, scan and verify prosumer QR codes, finalize energy transfers |
| **Solar Prosumer** | Mobile only | Register/manage own profile, reserve/modify/cancel energy slots, view booking history and dashboard, receive transaction QR codes |

Platform access is enforced by the API at login, not merely by which app a user happens to open. A Prosumer authenticating from the web client is refused, as is a Backoffice user authenticating from mobile.

## Features
 
### Web Application
- Role-based login (Backoffice / Grid Operator)
- Prosumer management: full account directory, reactivation request queue, approve or reject requests
- Staff management: create Backoffice/Grid Operator accounts, edit their details, disable and restore access, reset passwords
- Microgrid node management: create/update/deactivate solar hubs (GPS location, capacity, battery slots)
- Energy slot reservation management: create, update, cancel bookings
- Responsive UI built with Tailwind CSS & React.js
### Mobile Application
- Pure native Android with local SQLite persistence
- Prosumer registration using NIC as the primary key
- Profile editing and self-service account deactivation
- Reactivation flow: a deactivated prosumer can request reinstatement at login, track a pending request, or withdraw it
- Reserve, modify, and cancel energy slots
- Secure transaction QR code generation upon reservation approval
- Dashboard showing active/pending reservation counts
- Google Maps integration to display nearby grid nodes
- Booking history, pending bookings, and search functionality
- Grid Operator mode: QR code scanning, server-side verification, and finalizing energy transfers
### Web Service (API)
- FAT service architecture — all validation and business rules enforced centrally
- MongoDB integration for all persistent data
- JWT bearer authentication with role claims, verified on every protected endpoint
- RESTful endpoints consumed identically by both web and mobile clients

## Database Design
 
MongoDB collections used by the system:
 
| Collection | Purpose | Key Fields |
|---|---|---|
| **Users** | Backoffice, Grid Operator, and Prosumer accounts | NIC (prosumer primary key), username, role, password hash, active status, reactivation request state |
| **SolarStationInfo** | Microgrid node/hub details | Station ID, GPS coordinates, capacity (kW/h), battery slot count, schedule, active status |
| **EnergyBookingSlots** | Available slots per station | Slot ID, station reference, time slot, availability status |
| **EnergyReservation** | Prosumer trading reservations | Reservation ID, prosumer NIC, station/slot reference, scheduled time, status, QR code data |

### Prosumer Account States

A prosumer account is always in exactly one of three states. The API derives the
state from stored flags rather than keeping a separate status field, so the two can
never contradict each other, and returns it as `status` on every account response.

| State | Condition | Meaning |
|---|---|---|
| `Active` | `isActive: true` | Can sign in and make reservations |
| `Deactivated` | `isActive: false`, no reactivation request | Left voluntarily; no action outstanding |
| `PendingReactivation` | `isActive: false`, reactivation requested | Waiting in the Backoffice queue |

Staff accounts use `isActive` alone: they have no self-service route back, so only a Backoffice user can restore one.
 
## Getting Started
 
### Prerequisites
 
- [.NET SDK](https://dotnet.microsoft.com/) (for the Web API)
- Windows IIS (for deployment) — or run locally via `dotnet run` during development
- [MongoDB](https://www.mongodb.com/try/download/community) (local) or a [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- [Android Studio](https://developer.android.com/studio) (for the mobile app)
- A Google Maps API key ([Google Cloud Console](https://console.cloud.google.com/))
- Node.js (for React.js)
- Git

### Web Service (API) Setup
 
```bash
cd API
cp appsettings.Example.json appsettings.json
# Edit appsettings.json with your MongoDB connection string, JWT signing key,
# and SeedAdminSettings (see below)
dotnet restore
dotnet run
```

The API will start locally (check console output for the port). For production, publish and deploy to IIS:
 
```bash
dotnet publish -c Release -o ./publish
```
 
Then configure a new site in IIS Manager pointing to the `publish` folder.

#### The first Backoffice account

Creating a Backoffice or Grid Operator account requires an already-authenticated
Backoffice caller, so the very first one cannot be created through the API. It is
seeded at startup instead, from the `SeedAdminSettings` section of
`appsettings.json`:

```json
"SeedAdminSettings": {
  "Username": "admin",
  "Password": "PUT-A-STRONG-PASSWORD-HERE",
  "FullName": "System Administrator",
  "Email": "admin@heliogrid.local",
  "Phone": "0000000000"
}
```

The seed runs on every startup but does nothing while an **active** Backoffice
account already exists, so it is safe to leave in place permanently. If every
Backoffice account has been deactivated, a restart restores the seed account
(keeping its existing password) rather than creating a duplicate.

Nothing is emailed or displayed: the credentials are whatever is configured here,
known to whoever set up the deployment. Sign in with them, create real
administrator accounts, and stop using the seed account.

### Web Application Setup
 
```bash
cd Web
cp .env.example .env 
# then set VITE_API_BASE_URL to the API's base URL, including /api
# e.g. VITE_API_BASE_URL=http://localhost:5000/api
npm install
npm run dev
```
## API Endpoint Contract

### Users & Authentication

| Method | Route | Purpose | Auth/Role |
|---|---|---|---|
| POST | `/api/users/register` | Register a user. Prosumer sign-up is public and mobile-only; Backoffice/GridOperator accounts require an authenticated Backoffice caller | Public / Backoffice |
| POST | `/api/users/login` | Authenticate and return a JWT with role and profile. Reports account state for a deactivated prosumer instead of a flat refusal | Public |
| POST | `/api/users/login/prosumer` | Authenticate a Prosumer by NIC and return a JWT and profile | Public |
| GET | `/api/users/{nic}` | Get a prosumer's own profile | Prosumer (own record) |
| PUT | `/api/users/{nic}` | Update a prosumer's own profile | Prosumer (own record) |
| PUT | `/api/users/{nic}/password` | Prosumer changes their own password (current password required) | Prosumer (own record) |
| PUT | `/api/users/{nic}/deactivate` | Prosumer deactivates their own account | Prosumer (own record) |
| POST | `/api/users/reactivation-request` | Deactivated prosumer requests reinstatement (NIC + password) | Public |
| POST | `/api/users/reactivation-request/cancel` | Withdraw a pending reactivation request | Public |
| GET | `/api/users/reactivation-requests` | List prosumers awaiting reactivation, oldest request first | Backoffice only |
| PUT | `/api/users/{nic}/reactivate` | Approve a request, or restore any deactivated prosumer | Backoffice only |
| PUT | `/api/users/{nic}/reject-reactivation` | Decline a pending request, with an optional reason | Backoffice only |
| GET | `/api/users/prosumers` | List every prosumer account with its status | Backoffice only |
| PUT | `/api/users/prosumers/{nic}/deactivate` | Deactivate a Prosumer account, with an optional reason | Backoffice only |
| PUT | `/api/users/prosumers/{nic}/password` | Reset a Prosumer account password | Backoffice only |
| GET | `/api/users/staff` | List every Backoffice/GridOperator account | Backoffice only |
| PUT | `/api/users/staff/{username}` | Edit a staff member's contact details | Backoffice only |
| PUT | `/api/users/staff/{username}/deactivate` | Disable a staff account's access | Backoffice only |
| PUT | `/api/users/staff/{username}/reactivate` | Restore a staff account | Backoffice only |
| PUT | `/api/users/staff/{username}/password` | Reset a staff member's password | Backoffice only |

The two reactivation endpoints are public by necessity: a deactivated account is
never issued a token, so its owner cannot reach an authorized endpoint. Re-sending
the NIC and password authenticates those calls.

### Stations, Slots & Reservations

| Method | Route | Purpose | Auth/Role |
|---|---|---|---|
| GET | `/api/stations` | List all stations | Any authenticated |
| GET | `/api/stations/nearby?lat=&lng=&radiusKm=` | Stations near a point | Any authenticated |
| POST | `/api/stations` | Create station | Backoffice only |
| PUT | `/api/stations/{stationId}` | Update station (schedule/capacity) | Backoffice only |
| PUT | `/api/stations/{stationId}/deactivate` | Deactivate (blocked if active reservations exist) | Backoffice only |
| PUT | `/api/stations/{stationId}/reactivate` | Reactivate a station | Backoffice only |
| DELETE | `/api/stations/{stationId}` | Delete a station when no reservation references it | Backoffice only |
| GET | `/api/stations/{stationId}/slots` | List a station's slots, optionally by month or upcoming status | Any authenticated |
| POST | `/api/stations/{stationId}/slots` | Generate recurring slots for a station | Backoffice only |
| PUT | `/api/slots/{slotId}` | Update a slot's time window | Backoffice only |
| PUT | `/api/slots/{slotId}/availability` | Change a slot's availability | GridOperator only |
| DELETE | `/api/slots/{slotId}` | Delete a slot when no active reservation blocks it | Backoffice only |
| GET | `/api/reservations` | List reservations with filtering and pagination | GridOperator / Backoffice |
| POST | `/api/reservations` | Create reservation (enforces 7-day rule) | Prosumer |
| PUT | `/api/reservations/{id}` | Update reservation (enforces 12-hour rule) | Prosumer / GridOperator |
| PUT | `/api/reservations/{id}/cancel` | Cancel reservation (enforces 12-hour rule) | Prosumer / GridOperator |
| GET | `/api/reservations/prosumer/{nic}` | Full booking history for a prosumer | Prosumer (own) / GridOperator |
| GET | `/api/reservations/prosumer/{nic}/pending` | Pending bookings only | Prosumer (own) |
| GET | `/api/reservations/prosumer/{nic}/dashboard-counts` | Returns `{ pendingCount, approvedFutureCount }` as two distinct values | Prosumer (own) |
| PUT | `/api/reservations/{id}/approve` | Approve + generate QR data | GridOperator |
| PUT | `/api/reservations/{id}/status` | Approve, decline, or complete a reservation | GridOperator |
| GET | `/api/reservations/{id}/qr` | Retrieve a Prosumer's reservation QR | Prosumer (own) |
| PUT | `/api/reservations/{id}/regenerate-qr` | Regenerate a Prosumer's reservation QR | Prosumer (own) |
| GET | `/api/reservations/{id}/qr-status` | Retrieve reservation QR status | GridOperator / Backoffice |
| PUT | `/api/reservations/{id}/revoke-qr` | Revoke a reservation QR | GridOperator / Backoffice |
| GET | `/api/reservations/{id}/qr-audit` | Retrieve reservation QR audit history | GridOperator / Backoffice |
| POST | `/api/reservations/verify-qr` | Verify scanned QR against server, finalize transfer | GridOperator |
| GET | `/api/reservations/qr-scans/recent` | List the authenticated operator's recent QR scans | GridOperator |

### Response Shape

Every endpoint answers with the same envelope, so both clients parse results identically:

```json
{ "success": true,  "data": { } }          // or "message" for write operations
{ "success": false, "message": "..." }     // with a non-2xx status
```

## Business Rules
 
These rules are enforced **exclusively within the Web API**:

### Reservations
- Energy slot reservations must be scheduled within **7 days** of creation.
- Updating or cancelling a reservation requires at least **12 hours' notice**.
- A microgrid node cannot be deactivated while it has **active energy reservations**.
- QR codes are verified against live server data before any energy transfer is finalized.

### Accounts
- A prosumer's **NIC is the primary key** and must be unique.
- A deactivated prosumer **cannot register again with the same NIC** — reactivation is the only route back.
- Only a **Backoffice** user can reactivate a deactivated prosumer account.
- Prosumers cannot authenticate from the web client; Backoffice users cannot authenticate from mobile.
- Passwords are **BCrypt-hashed** before storage and must be at least **8 characters**.
- A Backoffice user **cannot deactivate their own account**.
- The **last active Backoffice account cannot be deactivated** — creating one requires an authenticated Backoffice caller, so reaching zero would leave the system unadministerable.

## Deploying the Web API to Windows IIS

### 1. Prepare the Windows server

1. Open Turn Windows features on or off (or Server Manager on Windows Server).
2. Enable Internet Information Services (IIS).
3. Under Web Management Tools, enable IIS Management Console.
4. Install the ASP.NET Core Hosting Bundle that matches the .NET runtime targeted
   by the API project. The Hosting Bundle installs the ASP.NET Core Module used by IIS
   to host the application.
5. Restart IIS after installing the Hosting Bundle. From an elevated terminal:

```powershell
iisreset
```

### 2. Prepare the production API configuration

1. In the API project, create appsettings.json from the committed example file.
2. Configure the same settings defined by appsettings.Example.json, including:
   - MongoDB connection/database settings.
   - JWT signing/authentication settings.
   - SeedAdminSettings for the first Backoffice account.
3. Use production values on the server and do not commit real secrets or passwords
   to Git.
4. Confirm that the IIS server can reach the configured MongoDB server or MongoDB
   Atlas cluster.

### 3. Publish the API

From the repository root:

```powershell
cd API
dotnet restore
dotnet publish -c Release -o .\publish
```

The publish directory contains the deployable API files. Keep the generated
web.config file in the published output because IIS uses it to start the ASP.NET
Core application.

### 4. Copy the published application to the IIS server

Copy the complete contents of API\publish to a deployment directory on the IIS
machine, for example:

```text
C:\inetpub\HelioGridApi
```

Place the production appsettings.json in the deployed application directory if it
is not already included in the publish output.

### 5. Create an IIS Application Pool

1. Open IIS Manager.
2. Select Application Pools.
3. Choose Add Application Pool....
4. Use a name such as HelioGridApiPool.
5. Set .NET CLR version to No Managed Code.
6. Leave Managed pipeline mode as Integrated.
7. Start the application pool.

ASP.NET Core runs its own .NET runtime process; IIS acts as the front-end host through
the ASP.NET Core Module, which is why No Managed Code is used for the IIS pool.

### 6. Create the IIS website

1. In IIS Manager, right-click Sites and choose Add Website....
2. Enter a site name such as HelioGridApi.
3. Select HelioGridApiPool as the application pool.
4. Set the physical path to the published directory, for example:

   ```text
   C:\inetpub\HelioGridApi
   ```

5. Configure the binding:
   - Type: http for local/LAN testing, or https for a secured deployment.
   - IP address: the server address or All Unassigned.
   - Port: an available port such as 5000, 8080, or the port assigned by the
     deployment environment.
   - Host name: configure one if the server uses a DNS name.
6. Save the site and start it.

For a real deployment, HTTPS is recommended. Add the server certificate in IIS and
create an https binding when a certificate/domain is available.

### 7. Grant IIS access to the deployment folder

The application-pool identity must be able to read and execute the published files.

1. Open the deployment directory properties.
2. Go to Security -> Edit -> Add.
3. Add:

   ```text
   IIS AppPool\HelioGridApiPool
   ```

4. Grant Read & execute, List folder contents, and Read permissions.

Do not grant write permission to the entire application directory unless the
application genuinely needs it. If a specific log/upload directory needs writing,
grant permission only to that directory.

### 8. Configure networking and firewall access

1. Allow inbound TCP traffic for the IIS binding port in Windows Firewall.
2. If MongoDB is hosted on another machine or in Atlas, make sure the IIS server is
   allowed to connect to it.
3. When MongoDB Atlas IP access lists are used, add the public IP address used by the
   IIS server.
4. Use the IIS server's reachable IP address or DNS name from other devices; do not
   use localhost from the Android device or another computer.

### 9. Start and verify the API

1. In IIS Manager, confirm both the site and application pool are Started.
2. Browse to the deployed API host.
3. If Swagger is enabled in the deployed environment, open:

   ```text
   http://<server-host>:<port>/swagger
   ```

4. Otherwise, test the API with Swagger/Postman from the development environment by
   calling a public endpoint such as login.
5. Check Event Viewer, IIS logs, and the application-pool state if the API fails
   to start.

A successful deployment should allow both the Web and Android clients to reach the
same IIS-hosted API and receive normal API responses.

### 10. Point both clients to the IIS-hosted API

For the React web client, set the environment variable to the deployed API URL:

```text
VITE_API_BASE_URL=http://<server-host>:<port>/api
```

Then rebuild/restart the web client as required.

For Android, set the application's API base URL to the same reachable IIS host. A
physical Android device must use the server's LAN/public IP address or DNS name, not
localhost.

If HTTPS is configured, use the https:// URL in both clients.

### 11. Updating an existing IIS deployment

When a new API version is ready:

```powershell
cd API
dotnet publish -c Release -o .\publish
```

Then:

1. Stop the IIS site or application pool.
2. Replace the deployed application files with the new publish output.
3. Preserve/reapply the production configuration and secrets.
4. Start/recycle the application pool and site.
5. Re-test login, MongoDB connectivity, and the main Web/Mobile API flows

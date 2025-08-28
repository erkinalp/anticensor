# Geodata Message Types and Query System Specifications

**Copied from:** https://github.com/spacebarchat/server/issues/975  
**Original Issue:** New message type and query system for geographical data #975  
**Status:** Enhancement  
**Labels:** Enhancement, Needs more information  

## Problem Description

Instant messaging systems have an enormous potential for routing and querying messages. However, very few of them support the necessary message types for complex (involving more than a single coordinate) geographical/spatio-temporal data. One of the examples in this space is WhatsApp's ongoing location share.

## Solution Overview

A new message type can be used to describe this feature.

## Technical Specifications

### 1. New Message Types

The following new message types will be added to the `MessageType` enum:

```typescript
LOCATION_SHARE = 72,        // Single location share (lat/lng/timestamp)
LOCATION_LIVE = 73,         // Live location sharing (ongoing)
LOCATION_QUERY = 74,        // Spatial query for nearby content
LOCATION_RESPONSE = 75,     // Response to spatial query
GEOFENCE_ALERT = 76,        // Geofence entry/exit notification
```

### 2. Data Structures

#### Core Geodata Interfaces

```typescript
export interface GeoLocation {
  latitude: number;           // WGS84 decimal degrees
  longitude: number;          // WGS84 decimal degrees
  altitude?: number;          // Meters above sea level
  accuracy?: number;          // Accuracy radius in meters
  timestamp: Date;            // When location was captured
  address?: string;           // Human-readable address (optional)
}

export interface LiveLocationShare {
  location: GeoLocation;      // Current location
  duration_ms: number;        // How long to share (milliseconds)
  update_interval_ms: number; // Update frequency (milliseconds)
  expires_at: Date;           // When sharing expires
}

export interface SpatialQuery {
  center: GeoLocation;        // Query center point
  radius_meters: number;      // Search radius in meters
  query_type: 'messages' | 'users' | 'channels'; // What to search for
  time_range?: {              // Optional time filtering
    start: Date;
    end: Date;
  };
}

export interface GeofenceDefinition {
  id: string;                 // Unique geofence identifier
  name: string;               // Human-readable name
  geometry: GeoLocation[] | { // Polygon or circle definition
    center: GeoLocation;
    radius_meters: number;
  };
  trigger_on: 'enter' | 'exit' | 'both'; // When to trigger alerts
}
```

#### Message Entity Extensions

New optional columns for the Message entity:

```typescript
@Column({ type: "simple-json", nullable: true })
geo_location?: GeoLocation;

@Column({ type: "simple-json", nullable: true })
live_location?: LiveLocationShare;

@Column({ type: "simple-json", nullable: true })
spatial_query?: SpatialQuery;

@Column({ type: "simple-json", nullable: true })
geofence_data?: GeofenceDefinition;
```

#### Channel Entity Extensions

New columns for the Channel entity to support geodata features:

```typescript
@Column({ type: "simple-json", nullable: true })
geofences?: GeofenceDefinition[];

@Column({ default: false })
location_sharing_enabled: boolean = false;

@Column({ nullable: true })
default_location_share_duration_ms?: number;
```

### 3. API Endpoints

#### Extended Message Creation
- **Endpoint:** `POST /channels/{channel_id}/messages`
- **Extension:** Support new geodata message types in request body
- **Request Body:** Standard message creation with additional geodata fields

#### Spatial Query Endpoint
- **Endpoint:** `GET /channels/{channel_id}/messages/spatial`
- **Query Parameters:**
  - `lat` (required): Center latitude
  - `lng` (required): Center longitude
  - `radius` (required): Search radius in meters
  - `type` (optional): Filter by message type
  - `start_time` (optional): Start of time range (ISO 8601)
  - `end_time` (optional): End of time range (ISO 8601)
  - `limit` (optional): Maximum results (default: 50, max: 100)

#### Geofence Management
- **Create:** `POST /channels/{channel_id}/geofences`
- **List:** `GET /channels/{channel_id}/geofences`
- **Update:** `PUT /channels/{channel_id}/geofences/{geofence_id}`
- **Delete:** `DELETE /channels/{channel_id}/geofences/{geofence_id}`

#### Live Location Updates
- **Endpoint:** `GET /channels/{channel_id}/messages/{message_id}/location/live`
- **Purpose:** Get real-time location updates for live sharing messages
- **Response:** Stream of location updates via Server-Sent Events

### 4. WebSocket Events

#### New Real-time Events
```typescript
// Live location updates
LOCATION_UPDATE: {
  message_id: string;
  location: GeoLocation;
  expires_at: Date;
}

// Geofence triggers
GEOFENCE_TRIGGERED: {
  geofence_id: string;
  user_id: string;
  trigger_type: 'enter' | 'exit';
  location: GeoLocation;
  timestamp: Date;
}

// Spatial query results
SPATIAL_QUERY_RESULT: {
  query_id: string;
  results: Message[];
  total_count: number;
}
```

### 5. Capability Flags

New capability flags for backward compatibility (placed after bit 36):

```typescript
GEODATA_MESSAGES: BitFlag(38),    // Support for geodata message types
SPATIAL_QUERIES: BitFlag(39),     // Support for spatial queries
LIVE_LOCATION: BitFlag(40),       // Support for live location sharing
GEOFENCES: BitFlag(41),           // Support for geofence features
```

### 6. Database Migrations

#### Messages Table
```sql
ALTER TABLE messages 
ADD COLUMN geo_location TEXT NULL,
ADD COLUMN live_location TEXT NULL,
ADD COLUMN spatial_query TEXT NULL,
ADD COLUMN geofence_data TEXT NULL;
```

#### Channels Table
```sql
ALTER TABLE channels 
ADD COLUMN geofences TEXT NULL,
ADD COLUMN location_sharing_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN default_location_share_duration_ms INTEGER NULL;
```

#### Spatial Indexes
```sql
-- For efficient spatial queries (implementation-specific)
-- PostgreSQL with PostGIS:
CREATE INDEX idx_messages_geo_location ON messages 
USING GIST (ST_GeomFromGeoJSON(geo_location->>'coordinates'));

-- MySQL with spatial extensions:
CREATE SPATIAL INDEX idx_messages_geo_location ON messages 
((ST_GeomFromGeoJSON(geo_location->>'coordinates')));
```

### 7. Security and Privacy Considerations

#### Location Data Protection
- All location data encrypted at rest using AES-256
- Location sharing requires explicit user consent
- Automatic expiration of location data based on retention policies
- User controls for location sharing visibility (public, friends, specific users)

#### Permission Model
- New permission: `SHARE_LOCATION` - Allow sharing location in channel
- New permission: `VIEW_LOCATION` - Allow viewing others' location data
- New permission: `MANAGE_GEOFENCES` - Create/modify geofences in channel
- New permission: `SPATIAL_QUERY` - Perform spatial queries in channel

#### Data Retention
- Live location data automatically deleted after expiration
- Historical location data subject to configurable retention periods
- User right to delete all location data on request
- Geofence data persists until manually deleted by authorized users

### 8. Research from Comparable Protocols

#### WhatsApp Location Features
- **Live Location Sharing:** Real-time location updates for specified duration
- **Static Location Sharing:** Single point-in-time location share
- **Location Search:** Find nearby businesses and points of interest
- **Privacy Controls:** Granular control over who can see location

#### Telegram Location Features (Historical)
- **People Nearby:** Discover users in proximity (removed due to privacy/security concerns)
- **Location Sharing:** Static and live location sharing
- **Venue Sharing:** Share specific businesses/landmarks

#### Signal Approach
- **Privacy-First:** No location features to maintain user privacy
- **Principle:** Location data considered too sensitive for messaging platform

#### Matrix Protocol Considerations
- **Federated Architecture:** Location data must work across different servers
- **Event-Based:** Location updates as room events
- **Extensibility:** Custom event types for geodata

#### XMPP Geodata Extensions
- **XEP-0080:** User Location specification
- **XEP-0255:** Location Query protocol
- **Geolocation Elements:** Standardized location data format

### 9. Implementation Phases

#### Phase 1: Core Infrastructure
- Implement basic geodata message types
- Add database schema changes
- Create basic API endpoints

#### Phase 2: Spatial Queries
- Implement spatial indexing
- Add spatial query endpoints
- Optimize query performance

#### Phase 3: Real-time Features
- Implement live location sharing
- Add WebSocket events for real-time updates
- Create geofence monitoring system

#### Phase 4: Advanced Features
- Add complex geofence shapes (polygons)
- Implement location-based notifications
- Add analytics and reporting features

### 10. IoT Application Support

#### Extended Data Types for IoT
```typescript
export interface IoTSensorData {
  sensor_id: string;
  sensor_type: 'temperature' | 'humidity' | 'air_quality' | 'motion' | 'custom';
  value: number;
  unit: string;
  location: GeoLocation;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface IoTDeviceStatus {
  device_id: string;
  status: 'online' | 'offline' | 'maintenance';
  battery_level?: number;
  signal_strength?: number;
  last_seen: Date;
  location: GeoLocation;
}
```

#### IoT-Specific Message Types
```typescript
IOT_SENSOR_DATA = 77,       // Sensor reading with location
IOT_DEVICE_STATUS = 78,     // Device status update
IOT_ALERT = 79,             // IoT device alert/alarm
```

### 11. Performance Considerations

#### Spatial Query Optimization
- Use spatial database indexes (R-tree, Quad-tree)
- Implement query result caching for frequently accessed areas
- Add pagination for large result sets
- Consider using specialized spatial databases (PostGIS, MongoDB with 2dsphere)

#### Real-time Update Efficiency
- Batch location updates to reduce WebSocket traffic
- Use delta compression for location updates
- Implement adaptive update intervals based on movement speed
- Add client-side location prediction to reduce server load

### 12. Testing Strategy

#### Unit Tests
- Geodata message type validation
- Spatial query accuracy
- Geofence trigger logic
- Location data encryption/decryption

#### Integration Tests
- End-to-end location sharing workflows
- Spatial query performance with large datasets
- Real-time update delivery
- Cross-client compatibility

#### Load Tests
- Concurrent live location sharing
- High-frequency spatial queries
- Geofence monitoring at scale
- WebSocket connection limits

This specification provides a comprehensive foundation for implementing geodata features in the Spacebar server while maintaining compatibility with Discord clients and supporting advanced use cases including IoT applications.

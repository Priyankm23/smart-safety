import { MAPBOX_ACCESS_TOKEN } from "../../../../config";
import { getTrackingEnhancementScript } from "./mapTrackingEnhancement";

export const generateMapHTML = (accessToken?: string): string => {
  // Use provided token or fallback to config
  const token = accessToken || MAPBOX_ACCESS_TOKEN;
  const trackingScript = getTrackingEnhancementScript();

  return `
  <!DOCTYPE html>
  <html>
  <head>
      <meta charset="utf-8" />
      <title>Mapbox Map</title>
      <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
      <link href="https://api.mapbox.com/mapbox-gl-js/v2.8.2/mapbox-gl.css" rel="stylesheet" />
      <script src="https://api.mapbox.com/mapbox-gl-js/v2.8.2/mapbox-gl.js"></script>
      <script src="https://npmcdn.com/@turf/turf/turf.min.js"></script>
      <style>
          body { margin: 0; padding: 0; }
          #map { position: absolute; top: 0; bottom: 0; width: 100%; }
          .mapboxgl-popup-content { font-family: sans-serif; }

          /* Pulsing User Marker - Blue Dot with Pulse */
          .user-marker-container {
            position: relative;
            width: 24px;
            height: 24px;
          }
          
          .user-marker {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: linear-gradient(145deg, #4A90D9, #2563EB);
            border: 3px solid #ffffff;
            box-shadow: 0 2px 8px rgba(37, 99, 235, 0.5);
            position: relative;
            z-index: 2;
          }
          
          .user-marker-pulse {
            position: absolute;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: rgba(66, 133, 244, 0.35);
            animation: pulse-ring 1.5s ease-out infinite;
            top: -3px;
            left: -3px;
            z-index: 1;
          }

          @keyframes pulse-ring {
            0% { transform: scale(0.8); opacity: 1; }
            100% { transform: scale(2.5); opacity: 0; }
          }

                    /* Waypoint markers for itinerary steps */
                    .wp-marker {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 32px;
                        height: 32px;
                        transform: translateZ(0);
                    }

                    .wp-pin {
                        width: 30px;
                        height: 30px;
                        border-radius: 999px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #fff;
                        font-weight: 700;
                        font-size: 12px;
                        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.24);
                        border: 2px solid #fff;
                    }

                    .wp-start { background: #16a34a; }
                    .wp-end { background: #dc2626; }
                    .wp-stop {
                        background: #2563eb;
                        color: #ffffff;
                    }

                    .lucide-pin-marker {
                        width: 34px;
                        height: 34px;
                        position: relative;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }

                    .lucide-pin-marker svg {
                        width: 34px;
                        height: 34px;
                    }

                    .lucide-pin-text {
                        position: absolute;
                        top: 9px;
                        left: 50%;
                        transform: translateX(-50%);
                        font-size: 10px;
                        font-weight: 700;
                        color: #ffffff;
                        line-height: 1;
                        pointer-events: none;
                    }

                    .destination-marker-fallback {
                        width: 30px;
                        height: 30px;
                        border-radius: 999px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #fff;
                        background: #dc2626;
                        border: 2px solid #fff;
                        font-weight: 700;
                        font-size: 12px;
                        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.24);
                    }

          /* Legend Styles */
          /* Legend styles removed - now using React Native bottom sheet */

          .legend-header {
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 12px;
            color: #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .legend-toggle {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 16px;
            padding: 0;
            color: #666;
          }

          .legend-stats {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 12px;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 8px;
            text-align: center;
          }

          .stat-item {
            display: flex;
            flex-direction: column;
          }

          .stat-number {
            font-size: 18px;
            font-weight: bold;
          }

          .stat-label {
            font-size: 9px;
            opacity: 0.9;
            margin-top: 2px;
          }

          .legend-section {
            margin-bottom: 12px;
          }

          .legend-section-title {
            font-weight: 600;
            font-size: 11px;
            margin-bottom: 8px;
            color: #555;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .zone-type-item {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            padding: 6px;
            background: #f9f9f9;
            border-radius: 4px;
            border-left: 3px solid;
          }

          .zone-type-item.danger {
            border-left-color: #ef4444;
          }

          .zone-type-item.risk {
            border-left-color: #f97316;
          }

          .zone-type-item.geofence {
            border-left-color: #3b82f6;
          }

          .zone-icon {
            font-size: 16px;
            margin-right: 8px;
            min-width: 20px;
            text-align: center;
          }

          .zone-info {
            flex: 1;
          }

          .zone-name {
            font-weight: 600;
            font-size: 11px;
            color: #333;
          }

          .zone-pattern {
            font-size: 9px;
            color: #666;
            margin-top: 2px;
          }

          .border-demo {
            display: inline-block;
            width: 25px;
            height: 2px;
            vertical-align: middle;
            margin: 0 3px;
          }

          .border-solid {
            border-top: 2px solid #333;
          }

          .border-dashed {
            border-top: 2px dashed #333;
          }

          .border-dotted {
            border-top: 2px dotted #333;
          }

          .severity-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
          }

          .severity-item {
            display: flex;
            align-items: center;
            font-size: 10px;
          }

          .severity-color {
            width: 16px;
            height: 16px;
            border-radius: 3px;
            margin-right: 6px;
            border: 1px solid rgba(0, 0, 0, 0.1);
          }

          .legend-collapsed .legend-content {
            display: none;
          }

          .legend-collapsed {
            padding: 10px 12px;
          }

          @media (max-width: 768px) {
            .map-legend {
              bottom: 10px;
              right: 10px;
              max-width: 240px;
              font-size: 11px;
            }

            .legend-stats {
              padding: 8px;
              gap: 6px;
            }

            .stat-number {
              font-size: 16px;
            }

            .stat-label {
              font-size: 8px;
            }
          }
      </style>
  </head>
  <body>
      <div id="map"></div>
      
      <!-- Legend removed - now using React Native bottom sheet -->
      <script>
          if (!'${token}'.startsWith('pk.')) {
            alert('Mapbox access token is not set. Please add MAPBOX_ACCESS_TOKEN to your environment variables or config.');
          }
          mapboxgl.accessToken = '${token}';
          const map = new mapboxgl.Map({
              container: 'map',
              style: 'mapbox://styles/mapbox/streets-v11',
              center: [78.9629, 20.5937], // Default to India center
              zoom: 4,
              attributionControl: false
          });

          // Add attribution control to top-right
          map.addControl(new mapboxgl.AttributionControl(), 'top-right');

           let userMarker = null;
           let userMarkerEl = null;
           let destinationMarker = null;
           let waypointMarkers = [];
           let currentWaypoints = [];
           let userAccuracySourceId = 'user-accuracy';
           let waypointSourceId = 'route-waypoints-source';
           let waypointCircleLayerId = 'route-waypoints-circle';
           let waypointLabelLayerId = 'route-waypoints-label';

           // Store route data to handle clicks
           let currentRoutesData = [];
           
           // Store geofence data for re-render after style change
           let currentFencesData = [];
           let userLocation = null;

          map.on('load', function () {
              window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'mapReady' }));

              // Load zone icons
              loadZoneIcons();

              // Load images for arrows/icons
              // Simple triangular arrow for direction
              const arrowIcon = {
                width: 24,
                height: 24,
                data: new Uint8Array(24 * 24 * 4).fill(255) // Placeholder if load fails, but we'll try to use standard
              };
              
              // Load a standard arrow icon from Mapbox icons or create one
              // For simplicity, we'll try to use a standard Mapbox icon or text if possible, 
              // but loading an image is more reliable for "line" placement.
              // Let's load a simple chevron arrow
               map.loadImage('https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png', (error, image) => {
                 // Using a generic marker for now if needed, but for lines we usually need an SDF or specific arrow
               });

              // Add geofences source/layers (kept from original)
              setupGeofenceLayers();

              // Setup Route Handlers
              setupRouteLayers();

                            // Accuracy source/layer for user location
                            if (!map.getSource(userAccuracySourceId)) {
                                map.addSource(userAccuracySourceId, {
                                    type: 'geojson',
                                    data: { type: 'FeatureCollection', features: [] }
                                });
                            }
                            if (!map.getLayer('user-accuracy-fill')) {
                                map.addLayer({
                                    id: 'user-accuracy-fill',
                                    type: 'fill',
                                    source: userAccuracySourceId,
                                    paint: {
                                        'fill-color': '#60a5fa',
                                        'fill-opacity': 0.18
                                    }
                                });
                            }
                            if (!map.getLayer('user-accuracy-line')) {
                                map.addLayer({
                                    id: 'user-accuracy-line',
                                    type: 'line',
                                    source: userAccuracySourceId,
                                    paint: {
                                        'line-color': '#3b82f6',
                                        'line-width': 1.5,
                                        'line-opacity': 0.45,
                                    }
                                });
                            }
          });

          // Create SVG patterns for different fill styles
          function createFillPatterns() {
              // Diagonal stripes pattern for danger zones
              const diagonalStripes = createPattern(64, 64, (ctx) => {
                  ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
                  ctx.lineWidth = 3;
                  for (let i = -64; i < 128; i += 8) {
                      ctx.beginPath();
                      ctx.moveTo(i, 0);
                      ctx.lineTo(i + 64, 64);
                      ctx.stroke();
                  }
              });
              if (diagonalStripes) map.addImage('diagonal-stripes', diagonalStripes, { pixelRatio: 2 });

              // Dot pattern for risk grids
              const dots = createPattern(20, 20, (ctx) => {
                  ctx.fillStyle = 'rgba(245, 158, 11, 0.7)';
                  ctx.beginPath();
                  ctx.arc(10, 10, 3, 0, Math.PI * 2);
                  ctx.fill();
              });
              if (dots) map.addImage('dots', dots, { pixelRatio: 2 });

              // Solid pattern (fallback)
              const solid = createPattern(1, 1, (ctx) => {
                  ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
                  ctx.fillRect(0, 0, 1, 1);
              });
              if (solid) map.addImage('solid', solid, { pixelRatio: 1 });
          }

          // Helper function to create canvas-based pattern
          function createPattern(width, height, drawFn) {
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (!ctx) return null;
              drawFn(ctx);
              return {
                  width: width,
                  height: height,
                  data: ctx.getImageData(0, 0, width, height).data
              };
          }

          // Load icon assets for different zone types
          function loadZoneIcons() {
              // Warning triangle for danger zones
              const warningTriangle = createIconImage(32, 32, (ctx) => {
                  ctx.fillStyle = '#ef4444';
                  ctx.strokeStyle = '#fff';
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.moveTo(16, 4);
                  ctx.lineTo(28, 26);
                  ctx.lineTo(4, 26);
                  ctx.closePath();
                  ctx.fill();
                  ctx.stroke();
                  // Exclamation mark
                  ctx.fillStyle = '#fff';
                  ctx.fillRect(14, 10, 4, 10);
                  ctx.fillRect(14, 22, 4, 3);
              });
              if (warningTriangle) map.addImage('warning-triangle', warningTriangle);

              // Incident marker for risk grids
              const incidentMarker = createIconImage(24, 24, (ctx) => {
                  ctx.fillStyle = '#f59e0b';
                  ctx.strokeStyle = '#fff';
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.arc(12, 12, 10, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.stroke();
                  // Warning symbol
                  ctx.fillStyle = '#fff';
                  ctx.font = 'bold 14px Arial';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText('!', 12, 12);
              });
              if (incidentMarker) map.addImage('incident-marker', incidentMarker);

              // Shield for geofences
              const shield = createIconImage(28, 32, (ctx) => {
                  ctx.fillStyle = '#3b82f6';
                  ctx.strokeStyle = '#fff';
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.moveTo(14, 2);
                  ctx.lineTo(26, 8);
                  ctx.lineTo(26, 18);
                  ctx.quadraticCurveTo(26, 28, 14, 30);
                  ctx.quadraticCurveTo(2, 28, 2, 18);
                  ctx.lineTo(2, 8);
                  ctx.closePath();
                  ctx.fill();
                  ctx.stroke();
                  // Checkmark
                  ctx.strokeStyle = '#fff';
                  ctx.lineWidth = 3;
                  ctx.beginPath();
                  ctx.moveTo(8, 15);
                  ctx.lineTo(12, 19);
                  ctx.lineTo(20, 11);
                  ctx.stroke();
              });
              if (shield) map.addImage('shield', shield);
          }

          // Helper to create icon image from canvas
          function createIconImage(width, height, drawFn) {
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (!ctx) return null;
              drawFn(ctx);
              return {
                  width: width,
                  height: height,
                  data: ctx.getImageData(0, 0, width, height).data
              };
          }

           function setupGeofenceLayers() {
              // Create patterns for different fill styles
              createFillPatterns();

              map.addSource('geofences', {
                  type: 'geojson',
                  data: { type: 'FeatureCollection', features: [] }
              });

              // Layer 1: Fill with patterns (lowest priority)
              map.addLayer({
                  id: 'geofence-fill',
                  type: 'fill',
                  source: 'geofences',
                  paint: {
                      'fill-color': ['get', 'fillColor'],
                      'fill-opacity': ['get', 'fillOpacity'],
                      'fill-pattern': ['get', 'fillPattern']
                  }
              });

              // Layer 2: Border lines with different styles
              map.addLayer({
                  id: 'geofence-line',
                  type: 'line',
                  source: 'geofences',
                  paint: {
                      'line-color': ['get', 'borderColor'],
                      'line-width': ['get', 'borderWidth'],
                      'line-opacity': 0.9,
                      'line-dasharray': [
                          'match',
                          ['get', 'borderStyle'],
                          'dashed', ['literal', [4, 2]],
                          'dotted', ['literal', [1, 2]],
                          ['literal', [1, 0]] // solid
                      ]
                  }
              });

               // Layer 3: Icon markers for zone centers
              map.addLayer({
                id: 'geofence-icons',
                type: 'symbol',
                source: 'geofences',
                filter: ['has', 'iconType'],
                layout: {
                  'icon-image': ['get', 'iconType'],
                  'icon-size': 0.8,
                  'icon-allow-overlap': true,
                  'text-field': ['get', 'name'],
                  'text-size': 10,
                  'text-offset': [0, 2],
                  'text-anchor': 'top'
                },
                paint: {
                  'text-color': '#333',
                  'text-halo-color': '#fff',
                  'text-halo-width': 1
                }
              });
              
              // Add click handlers for zones to show details
              map.on('click', 'geofence-fill', handleZoneClick);
              map.on('click', 'geofence-line', handleZoneClick);
              
              // Change cursor on hover
              map.on('mouseenter', 'geofence-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
              map.on('mouseleave', 'geofence-fill', () => { map.getCanvas().style.cursor = ''; });
          }

          function setupRouteLayers() {
             // We will create sources/layers dynamically for multiple routes
             // or use a fixed set source 'routes-source'
          }

          function getEmptyFeatureCollection() {
              return { type: 'FeatureCollection', features: [] };
          }

          function ensureWaypointLayers() {
              if (!map.getSource(waypointSourceId)) {
                  map.addSource(waypointSourceId, {
                      type: 'geojson',
                      data: getEmptyFeatureCollection()
                  });
              }

              if (!map.getLayer(waypointCircleLayerId)) {
                  map.addLayer({
                      id: waypointCircleLayerId,
                      type: 'circle',
                      source: waypointSourceId,
                      paint: {
                          'circle-color': [
                              'match',
                              ['get', 'kind'],
                              'start', '#16a34a',
                              'end', '#dc2626',
                              '#2563eb'
                          ],
                          'circle-radius': [
                              'interpolate', ['linear'], ['zoom'],
                              8, 10,
                              12, 12,
                              16, 14
                          ],
                          'circle-stroke-color': '#ffffff',
                          'circle-stroke-width': 2,
                          'circle-opacity': 1,
                          'circle-pitch-alignment': 'map',
                          'circle-pitch-scale': 'map'
                      }
                  });
              }

              if (!map.getLayer(waypointLabelLayerId)) {
                  map.addLayer({
                      id: waypointLabelLayerId,
                      type: 'symbol',
                      source: waypointSourceId,
                      layout: {
                          'text-field': ['get', 'label'],
                          'text-size': [
                              'interpolate', ['linear'], ['zoom'],
                              8, 10,
                              12, 11,
                              16, 12
                          ],
                          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                          'text-allow-overlap': true,
                          'text-ignore-placement': true,
                          'text-anchor': 'center',
                          'text-offset': [0, 0],
                          'text-pitch-alignment': 'map',
                          'text-rotation-alignment': 'map'
                      },
                      paint: {
                          'text-color': '#ffffff',
                          'text-halo-color': 'rgba(0, 0, 0, 0.08)',
                          'text-halo-width': 0.5
                      }
                  });
              }
          }

          function clearWaypointData() {
              const source = map.getSource(waypointSourceId);
              if (source) {
                  source.setData(getEmptyFeatureCollection());
              }
          }

          // Handle zone clicks with overlap detection
          function handleZoneClick(e) {
              // Query all features at the click point
              const features = map.queryRenderedFeatures(e.point, {
                  layers: ['geofence-fill', 'geofence-line']
              });
              
              if (features.length === 0) return;
              
              // Prevent default map click
              e.originalEvent.stopPropagation();
              
              // Get unique zones (features might be duplicated between layers)
              const uniqueZones = [];
              const seenIds = new Set();
              
              features.forEach(feature => {
                  const id = feature.properties.id || feature.properties.name;
                  if (!seenIds.has(id)) {
                      seenIds.add(id);
                      uniqueZones.push(feature.properties);
                  }
              });
              
              // Sort by risk priority
              const riskPriority = { 'Very High': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
              uniqueZones.sort((a, b) => {
                  const priorityA = riskPriority[a.riskLevel] || 0;
                  const priorityB = riskPriority[b.riskLevel] || 0;
                  return priorityB - priorityA;
              });
              
              // Create popup content
              const popupContent = createPopupContent(uniqueZones);
              
              // Show popup
              new mapboxgl.Popup({ maxWidth: '400px' })
                  .setLngLat(e.lngLat)
                  .setHTML(popupContent)
                  .addTo(map);
          }
          
          // Create popup content for zones
          function createPopupContent(zones) {
              let html = '<div style="font-family: sans-serif; max-width: 380px;">';
              
              if (zones.length > 1) {
                  html += '<div style="font-weight: 600; font-size: 14px; margin-bottom: 10px; color: #333;">⚠️ ' + zones.length + ' Zones Found Here</div>';
                  html += '<div style="max-height: 400px; overflow-y: auto;">';
              }
              
              zones.forEach((zone, index) => {
                  if (index > 0) {
                      html += '<hr style="margin: 12px 0; border: 0; border-top: 1px solid #ddd;">';
                  }
                  
                  if (zone.zoneType === 'danger_zone') {
                      html += createDangerZonePopup(zone);
                  } else if (zone.zoneType === 'risk_grid') {
                      html += createRiskGridPopup(zone);
                  } else if (zone.zoneType === 'geofence') {
                      html += createGeofencePopup(zone);
                  } else {
                      // Legacy zone without type
                      html += createLegacyZonePopup(zone);
                  }
              });
              
              if (zones.length > 1) {
                  html += '</div>';
              }
              
              html += '</div>';
              return html;
          }
          
          // Create danger zone popup content
          function createDangerZonePopup(zone) {
              const badgeClass = zone.riskLevel ? 'badge-' + zone.riskLevel.toLowerCase().replace(/\\s+/g, '-') : 'badge-low';
              return \`
                  <div style="min-width: 200px;">
                      <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #333;">⚠️ \${zone.name || 'Danger Zone'}</div>
                      <div style="font-size: 12px; color: #666; margin: 4px 0;"><strong>Type:</strong> Danger Zone</div>
                      \${zone.category ? '<div style="font-size: 12px; color: #666; margin: 4px 0;"><strong>Category:</strong> ' + zone.category + '</div>' : ''}
                      \${zone.state ? '<div style="font-size: 12px; color: #666; margin: 4px 0;"><strong>State:</strong> ' + zone.state + '</div>' : ''}
                      <div style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-top: 8px; \${getBadgeStyle(badgeClass)}">\${zone.riskLevel || 'Unknown'}</div>
                  </div>
              \`;
          }
          
          // Create risk grid popup content with reasons
          function createRiskGridPopup(zone) {
              const badgeClass = zone.riskLevel ? 'badge-' + zone.riskLevel.toLowerCase().replace(/\\s+/g, '-') : 'badge-low';
              let html = \`
                  <div style="min-width: 250px;">
                      <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #333;">📍 \${zone.name || 'Risk Grid'}</div>
                      <div style="font-size: 12px; color: #666; margin: 4px 0;"><strong>Type:</strong> Risk Grid</div>
              \`;
              
              // Add grid-specific details from metadata
              if (zone.gridId) {
                  html += \`<div style="font-size: 12px; color: #666; margin: 4px 0;"><strong>Grid ID:</strong> \${zone.gridId}</div>\`;
              }
              if (zone.riskScore !== undefined && zone.riskScore !== null) {
                  html += \`<div style="font-size: 12px; color: #666; margin: 4px 0;"><strong>Risk Score:</strong> \${(zone.riskScore * 100).toFixed(1)}%</div>\`;
              }
              if (zone.lastUpdated) {
                  const date = new Date(zone.lastUpdated).toLocaleDateString();
                  html += \`<div style="font-size: 12px; color: #666; margin: 4px 0;"><strong>Last Updated:</strong> \${date}</div>\`;
              }
              
              html += \`<div style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-top: 8px; \${getBadgeStyle(badgeClass)}">\${zone.riskLevel || 'Unknown'}</div>\`;
              
              // Parse reasons from JSON string if needed
              let reasons = [];
              if (zone.reasons) {
                  try {
                      reasons = typeof zone.reasons === 'string' ? JSON.parse(zone.reasons) : zone.reasons;
                  } catch (e) {
                      console.warn('Failed to parse reasons:', e);
                  }
              }
              
              // Display reasons (SOS alerts and incidents)
              if (reasons && reasons.length > 0) {
                  html += \`
                      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
                          <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px; color: #555;">📋 Recent Events (\${reasons.length}):</div>
                          <div style="max-height: 200px; overflow-y: auto;">
                  \`;
                  
                  reasons.forEach(reason => {
                      const icon = reason.type === 'sos_alert' ? '🚨' : '⚠️';
                      const typeLabel = reason.type === 'sos_alert' ? 'SOS Alert' : 'Incident';
                      const date = new Date(reason.timestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                      });
                      
                      // Calculate severity percentage
                      let severityPercent;
                      if (reason.type === 'sos_alert') {
                          severityPercent = reason.severity || 0;
                      } else {
                          severityPercent = ((reason.severity || 0) * 100).toFixed(0);
                      }
                      
                      // Color based on severity
                      let severityColor = '#4ade80';
                      if (severityPercent > 70) severityColor = '#ef4444';
                      else if (severityPercent > 40) severityColor = '#f97316';
                      
                      html += \`
                          <div style="background: #f9fafb; padding: 8px; margin-bottom: 6px; border-radius: 6px; border-left: 3px solid \${severityColor};">
                              <div style="display: flex; justify-content: space-between; align-items: start;">
                                  <div style="flex: 1;">
                                      <div style="font-size: 12px; font-weight: 600; color: #374151;">\${icon} \${reason.title || 'Event'}</div>
                                      <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">\${typeLabel} • \${date}</div>
                                      \${reason.eventType ? '<div style="font-size: 10px; color: #9ca3af; margin-top: 2px;">Type: ' + reason.eventType + '</div>' : ''}
                                  </div>
                                  <div style="background: \${severityColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; margin-left: 8px;">
                                      \${severityPercent}%
                                  </div>
                              </div>
                          </div>
                      \`;
                  });
                  
                  html += \`
                          </div>
                      </div>
                  \`;
              } else {
                  html += \`
                      <div style="margin-top: 12px; padding: 8px; background: #f3f4f6; border-radius: 6px; font-size: 12px; color: #6b7280; text-align: center;">
                          No recent events recorded
                      </div>
                  \`;
              }
              
              html += '</div>';
              return html;
          }
          
          // Create geofence popup content
          function createGeofencePopup(zone) {
              const isItinerary = zone.sourceType === 'itinerary' || !!zone.activityNodeName;
              const zoneTypeLabel = isItinerary ? 'Itinerary Safe Zone' : 'Geofence';
              return \`
                  <div style="min-width: 200px;">
                      <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #333;">🛡️ \${zone.name || 'Geofence'}</div>
                      <div style="font-size: 12px; color: #666; margin: 4px 0;"><strong>Type:</strong> \${zoneTypeLabel}</div>
                      \${zone.destination ? '<div style="font-size: 12px; color: #666; margin: 4px 0;"><strong>Destination:</strong> ' + zone.destination + '</div>' : ''}
                      \${zone.activityNodeName ? '<div style="font-size: 12px; color: #666; margin: 4px 0;"><strong>Activity:</strong> ' + zone.activityNodeName + '</div>' : ''}
                      \${zone.dayNumber ? '<div style="font-size: 12px; color: #666; margin: 4px 0;"><strong>Day:</strong> ' + zone.dayNumber + '</div>' : ''}
                      \${zone.alertMessage ? '<div style="font-size: 12px; color: #666; margin: 4px 0;"><strong>Alert:</strong> ' + zone.alertMessage + '</div>' : ''}
                      <div style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-top: 8px; \${isItinerary ? 'background: #dcfce7; color: #166534;' : 'background: #dbeafe; color: #1e40af;'}">\${isItinerary ? 'Itinerary Zone' : 'Safe Zone'}</div>
                  </div>
              \`;
          }
          
          // Create legacy zone popup content
          function createLegacyZonePopup(zone) {
              const badgeClass = zone.riskLevel ? 'badge-' + zone.riskLevel.toLowerCase().replace(/\\s+/g, '-') : 'badge-low';
              return \`
                  <div style="min-width: 200px;">
                      <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #333;">\${zone.name || 'Zone'}</div>
                      <div style="font-size: 12px; color: #666; margin: 4px 0;"><strong>Type:</strong> \${zone.category || 'Unknown'}</div>
                      \${zone.state ? '<div style="font-size: 12px; color: #666; margin: 4px 0;"><strong>State:</strong> ' + zone.state + '</div>' : ''}
                      <div style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-top: 8px; \${getBadgeStyle(badgeClass)}">\${zone.riskLevel || 'Unknown'}</div>
                  </div>
              \`;
          }
          
          // Get badge styling based on risk level
          function getBadgeStyle(badgeClass) {
              const styles = {
                  'badge-low': 'background: #d1fae5; color: #065f46;',
                  'badge-medium': 'background: #fef3c7; color: #92400e;',
                  'badge-high': 'background: #fed7aa; color: #9a3412;',
                  'badge-very-high': 'background: #fee2e2; color: #991b1b;'
              };
              return styles[badgeClass] || styles['badge-low'];
          }

          // Legend functions removed - now using React Native bottom sheet

          map.on('click', function (e) {
              const features = map.queryRenderedFeatures(e.point, { layers: ['route-line-inactive-hitbox'] });
              
              if (features.length > 0) {
                 const index = features[0].properties.index;
                 if (index !== undefined) {
                    window.ReactNativeWebView?.postMessage(JSON.stringify({
                        type: 'routeSelected',
                        index: index
                    }));
                    return; // Handled
                 }
              }

              const { lng, lat } = e.lngLat;
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                  type: 'mapClick',
                  lng: lng,
                  lat: lat
              }));
          });

          // Unified message handler
          function handleMessageEvent(event) {
              try {
                const data = JSON.parse(event.data);
                switch (data.type) {
                    case 'updateLocation':
                        updateLocation(data.longitude, data.latitude, data.accuracy || 0, data.zoomLevel);
                        updateLocation(
                            data.longitude,
                            data.latitude,
                            data.accuracy || 0,
                            data.zoomLevel,
                            !!data.forceCenter
                        );
                        break;
                    case 'setLocation':
                        if (data.location) {
                            updateLocation(data.location.longitude, data.location.latitude, data.location.accuracy || 0, 14);
                            updateLocation(
                                data.location.longitude,
                                data.location.latitude,
                                data.location.accuracy || 0,
                                data.zoomLevel || 14,
                                !!data.forceCenter
                            );
                        }
                        break;
                    case 'setGeoFences':
                        renderGeoFences(data.fences || []);
                        break;
                    case 'clearGeoFences':
                        clearAllGeoFences();
                        break;
                    case 'setStyle':
                        if (data.style) {
                            const styleUrl = getStyleUrl(data.style);
                            map.setStyle(styleUrl);
                            
                            map.once('style.load', () => {
                                setupGeofenceLayers();
                                setupRouteLayers();
                                
                                if (currentFencesData.length > 0) {
                                    renderGeoFences(currentFencesData);
                                }
                                
                                if (currentRoutesData.length > 0) {
                                    renderRoutes(currentRoutesData, 0, 'driving');
                                    renderWaypoints(currentWaypoints);
                                }
                                
                                if (userLocation) {
                                    updateLocation(userLocation.lng, userLocation.lat, userLocation.accuracy || 0, 14);
                                }
                            });
                        }
                        break;
                    case 'setRoute':
                        // Handle both old single route format and new multi-route format
                        if (data.route) {
                           // Single route legacy support
                                    currentWaypoints = data.waypoints || [];
                                    renderRoutes([data.route], 0, 'driving');
                                    renderWaypoints(currentWaypoints);
                        } else if (data.routes) {
                                    currentWaypoints = data.waypoints || [];
                                    renderRoutes(data.routes, data.selectedIndex || 0, data.profile || 'driving');
                                    renderWaypoints(currentWaypoints);
                        }
                        break;
                    case 'clearRoute':
                        clearRoutes();
                        break;
                }
              } catch(e) {
                console.error("Msg Error", e);
              }
          }

          function getStyleUrl(styleKey) {
              const styles = {
                  'streets': 'mapbox://styles/mapbox/streets-v11',
                  'outdoors': 'mapbox://styles/mapbox/outdoors-v11',
                  'light': 'mapbox://styles/mapbox/light-v10',
                  'dark': 'mapbox://styles/mapbox/dark-v10',
                  'satellite': 'mapbox://styles/mapbox/satellite-v9',
                  'satelliteStreets': 'mapbox://styles/mapbox/satellite-streets-v11'
              };
              return styles[styleKey] || styles['streets'];
          }

          // --- ROUTE RENDERING ---
          function renderRoutes(routes, selectedIndex, profile) {
              clearRoutes();
              currentRoutesData = routes;

              if (!routes || routes.length === 0) return;

              // 1. Create Source with all routes as features
              const features = routes.map((r, i) => ({
                  type: 'Feature',
                  properties: {
                     index: i,
                     isActive: i === selectedIndex,
                     isWalking: profile === 'walking'
                  },
                  geometry: r.geometry
              }));

              // Center on the selected route
              const selectedFeature = features[selectedIndex] || features[0];
              const bbox = turf.bbox(selectedFeature);
              map.fitBounds(bbox, {
                  padding: { top: 130, right: 90, bottom: 170, left: 110 },
                  duration: 700
              });

                            // Add Destination Marker at end of selected route only if no explicit waypoints/end marker
                            if (!currentWaypoints || currentWaypoints.length === 0) {
                                const endCoord = selectedFeature.geometry.coordinates[selectedFeature.geometry.coordinates.length - 1];
                                addDestinationMarker(endCoord);
                            }

              // 2. Add Sources/Layers
              // We use one source
              const sourceId = 'routes-source';
              if (map.getSource(sourceId)) {
                  map.getSource(sourceId).setData({ type: 'FeatureCollection', features });
              } else {
                  map.addSource(sourceId, {
                      type: 'geojson',
                      data: { type: 'FeatureCollection', features }
                  });
              }

              // LAYER 1: Inactive routes (muted so active day route is clearly readable)
              if (!map.getLayer('route-inactive')) {
                  map.addLayer({
                      id: 'route-inactive',
                      type: 'line',
                      source: sourceId,
                      filter: ['==', 'isActive', false],
                      layout: {
                          'line-join': 'round',
                          'line-cap': 'round'
                      },
                      paint: {
                          'line-color': '#cbd5e1',
                          'line-width': [
                            'interpolate', ['linear'], ['zoom'],
                            8, 3,
                            12, 4,
                            16, 5
                          ],
                          'line-opacity': 0.55
                      }
                  });
              }
              
              // Transparent hitbox for easier clicking on inactive routes
              if (!map.getLayer('route-line-inactive-hitbox')) {
                  map.addLayer({
                      id: 'route-line-inactive-hitbox',
                      type: 'line',
                      source: sourceId,
                      filter: ['==', 'isActive', false],
                      layout: { 'line-join': 'round', 'line-cap': 'round' },
                      paint: {
                          'line-color': 'transparent',
                          'line-width': 20, // Wide touch area
                          'line-opacity': 0
                      }
                  });
              }

              // LAYER 2: Active route glow (subtle, improves contrast without clutter)
              if (!map.getLayer('route-active-glow')) {
                  map.addLayer({
                      id: 'route-active-glow',
                      type: 'line',
                      source: sourceId,
                      filter: ['==', 'isActive', true],
                      layout: { 'line-join': 'round', 'line-cap': 'round' },
                      paint: {
                          'line-color': '#38bdf8',
                          'line-width': [
                            'interpolate', ['linear'], ['zoom'],
                            8, 10,
                            12, 13,
                            16, 17
                          ],
                          'line-opacity': 0.2,
                          'line-blur': 1.6
                      }
                  });
              }

              // LAYER 3: Active route casing (clean edge)
              if (!map.getLayer('route-active-casing')) {
                  map.addLayer({
                      id: 'route-active-casing',
                      type: 'line',
                      source: sourceId,
                      filter: ['==', 'isActive', true],
                      layout: { 'line-join': 'round', 'line-cap': 'round' },
                      paint: {
                          'line-color': '#ffffff',
                          'line-width': [
                            'interpolate', ['linear'], ['zoom'],
                            8, 6,
                            12, 8,
                            16, 10
                          ],
                          'line-opacity': 0.96
                      }
                  });
              }

              // LAYER 4: Active route line
              if (!map.getLayer('route-active-line')) {
                  map.addLayer({
                      id: 'route-active-line',
                      type: 'line',
                      source: sourceId,
                      filter: ['==', 'isActive', true],
                      layout: { 'line-join': 'round', 'line-cap': 'round' },
                      paint: {
                          'line-color': profile === 'walking' ? '#0ea5e9' : '#2563eb',
                          'line-width': [
                            'interpolate', ['linear'], ['zoom'],
                            8, 3.5,
                            12, 5,
                            16, 6
                          ],
                          'line-opacity': 0.98,
                          'line-dasharray': profile === 'walking' ? [1, 1.8] : [1, 0]
                      }
                  });
              } else {
                 // Keep style in sync when profile changes
                 map.setPaintProperty('route-active-line', 'line-color', profile === 'walking' ? '#0ea5e9' : '#2563eb');
                 map.setPaintProperty('route-active-line', 'line-dasharray', profile === 'walking' ? [1, 1.8] : [1, 0]);
              }

              // LAYER 5: Direction arrows
              if (!map.getLayer('route-arrows')) {
                  map.addLayer({
                      id: 'route-arrows',
                      type: 'symbol',
                      source: sourceId,
                      filter: ['==', 'isActive', true],
                      layout: {
                          'symbol-placement': 'line',
                          'symbol-spacing': 72,
                          'text-field': '➤',
                          'text-size': 13,
                          'text-keep-upright': false,
                          'text-rotation-alignment': 'map'
                      },
                      paint: {
                          'text-color': '#1d4ed8',
                          'text-halo-color': '#ffffff',
                          'text-halo-width': 1.5
                      }
                  });
              }
          }

          function renderWaypoints(waypoints) {
              // Clear previous markers
              waypointMarkers.forEach(m => m.remove());
              waypointMarkers = [];
              if (!Array.isArray(waypoints) || waypoints.length === 0) {
                  clearWaypointData();
                  return;
              }

              if (!Array.isArray(waypoints) || waypoints.length === 0) return;
              ensureWaypointLayers();
              const features = [];

              waypoints.forEach((wp) => {
              waypoints.forEach((wp, idx) => {
                  if (!Number.isFinite(wp?.longitude) || !Number.isFinite(wp?.latitude)) return;

                  let el;
                  let markerOptions = { anchor: 'center' };
                  if (wp.kind === 'start' || wp.kind === 'end') {
                      el = createLucidePinMarker(wp.kind, wp.kind === 'start' ? 'S' : 'E');
                      markerOptions = { anchor: 'bottom', offset: [0, 2] };
                  } else {
                      el = document.createElement('div');
                      el.className = 'wp-marker';

                      const pin = document.createElement('div');
                      pin.className = 'wp-pin wp-stop';
                      pin.textContent = wp.label || '';

                      el.appendChild(pin);
                  }

                  const marker = new mapboxgl.Marker({ element: el, ...markerOptions })
                    .setLngLat([wp.longitude, wp.latitude])
                    .addTo(map);

                  waypointMarkers.push(marker);
                  const kind = wp.kind === 'start' || wp.kind === 'end' ? wp.kind : 'stop';
                  const label = kind === 'start'
                      ? 'S'
                      : kind === 'end'
                          ? 'E'
                          : (wp.label ? String(wp.label) : String(idx + 1));

                  features.push({
                      type: 'Feature',
                      geometry: {
                          type: 'Point',
                          coordinates: [wp.longitude, wp.latitude]
                      },
                      properties: { kind, label }
                  });
              });

              const source = map.getSource(waypointSourceId);
              if (source) {
                  source.setData({
                      type: 'FeatureCollection',
                      features
                  });
              }

                            // If waypoints include an explicit end, drop destinationMarker to avoid duplicate red pins
                            if (waypoints.some(wp => wp.kind === 'end') && destinationMarker) {
                                destinationMarker.remove();
                                destinationMarker = null;
                            }
          }

          function clearRoutes() {
              const sourceId = 'routes-source';
              if (map.getSource(sourceId)) {
                  map.getSource(sourceId).setData({ type: 'FeatureCollection', features: [] });
              }
              if (destinationMarker) {
                  destinationMarker.remove();
                  destinationMarker = null;
              }
              waypointMarkers.forEach(m => m.remove());
              waypointMarkers = [];
              clearWaypointData();
          }

          function createLucidePinMarker(kind, text) {
             const color = kind === 'start' ? '#16a34a' : '#dc2626';
             const el = document.createElement('div');
             el.className = 'lucide-pin-marker';
             el.innerHTML =
               '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                 '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="' + color + '"/>' +
                 '<circle cx="12" cy="10" r="3" fill="#ffffff"/>' +
               '</svg>' +
               '<span class="lucide-pin-text">' + (text || '') + '</span>';
             return el;
          }
          
          function addDestinationMarker(lngLat) {
             if (destinationMarker) destinationMarker.remove();
             
             const el = createLucidePinMarker('end', 'E');
             
             destinationMarker = new mapboxgl.Marker({ element: el, anchor: 'bottom', offset: [0, 2] })
                .setLngLat(lngLat)
                .addTo(map);
          }

          document.addEventListener('message', handleMessageEvent);
          window.addEventListener('message', handleMessageEvent);

           function updateLocation(lng, lat, accuracy, zoom) {
           function updateLocation(lng, lat, accuracy, zoom, forceCenter) {
               if (!map) return;
               
               userLocation = { lng, lat, accuracy };

               const isFirstLoad = !userMarker;

              // Create Custom Pulsing Marker if not exists
              if (!userMarker) {
                 const el = document.createElement('div');
                 el.className = 'user-marker';
                 el.innerHTML = '<div class="user-marker-pulse"></div>';
                 
                 userMarker = new mapboxgl.Marker({ element: el, anchor: 'center' })
                    .setLngLat([lng, lat])
                    .addTo(map);
                 
                 userMarkerEl = el;
              } else {
                 userMarker.setLngLat([lng, lat]);
              }
              
<<<<<<< Updated upstream
              // FlyTo on first load only
              if (isFirstLoad) {
                map.flyTo({ center: [lng, lat], zoom: zoom || 14 });
              }
                            if (isFirstLoad || forceCenter) {
                                map.flyTo({ center: [lng, lat], zoom: zoom || 14 });
                            }

                            // Update accuracy ring if we have accuracy in meters
                            try {
                                const accMeters = Number.isFinite(accuracy) ? Math.max(accuracy, 10) : 50;
                                const circle = turf.circle([lng, lat], accMeters / 1000, { steps: 64, units: 'kilometers' });
                                const src = map.getSource(userAccuracySourceId);
                                if (src) {
                                    src.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: circle.geometry, properties: {} }] });
                                }
                            } catch (e) {
                                console.warn('accuracy ring update failed', e);
                            }
=======
              // FlyTo on every location update
              map.flyTo({ center: [lng, lat], zoom: zoom || map.getZoom() });
>>>>>>> Stashed changes
          }

          // --- GEOFENCE FUNCTIONS (Kept from original logic) ---
          // ... (Reuse the styling/cluster functions from previous file content)
          // Simplified re-inclusion of helper functions to ensure file completion
          
          function getRiskPriority(level) { /* ... same ... */ } 
           function renderGeoFences(fences) {
               currentFencesData = fences;
               
               // Separate zones by type for different rendering strategies
               const dangerZones = fences.filter(f => 
                   f.visualStyle?.zoneType === 'danger_zone' || 
                   (f.category && f.category.toLowerCase().includes('danger'))
               );
               const riskGrids = fences.filter(f => 
                   f.visualStyle?.zoneType === 'risk_grid' || 
                   f.category === 'Risk Grid'
               );
               const geofencesDestinations = fences.filter(f => 
                   f.visualStyle?.zoneType === 'geofence' ||
                   f.visualStyle?.zoneType === 'itinerary_geofence' ||
                   f.category === 'Tourist Destination' ||
                   f.category === 'Itinerary Geofence' ||
                   f.metadata?.sourceType === 'itinerary'
               );
               const otherZones = fences.filter(f => 
                   !f.visualStyle?.zoneType && 
                   f.category !== 'Risk Grid' && 
                   f.category !== 'Tourist Destination' &&
                   f.category !== 'Itinerary Geofence' &&
                   (!f.category || !f.category.toLowerCase().includes('danger'))
               );
               
               const features = [];
               
               // Render danger zones with diagonal stripes
               dangerZones.forEach(fence => {
                   const geometry = createGeometry(fence);
                   if (geometry) {
                       const style = getGeofenceStyle(fence);
                       const center = getCenter(fence);
                       features.push({
                           type: 'Feature',
                           geometry: geometry,
                           properties: {
                               ...style,
                               name: fence.name,
                               id: fence.id,
                               zoneType: 'danger_zone',
                               riskLevel: fence.riskLevel,
                               category: fence.category,
                               state: fence.state,
                               centerLat: center[0],
                               centerLng: center[1]
                           }
                       });
                   }
               });
               
               // Cluster and render risk grids with dot patterns
               const clusters = clusterFeatures(riskGrids, 1.0); // 1km clustering distance
               clusters.forEach(cluster => {
                   if (cluster.length === 0) return;
                   
                   if (cluster.length === 1) {
                       // Single grid - render as-is
                       const fence = cluster[0];
                       const geometry = createGeometry(fence);
                       if (geometry) {
                           const style = getGeofenceStyle(fence);
                           const center = getCenter(fence);
                           
                           // Extract metadata for risk grids
                           const metadata = fence.metadata || {};
                           
                           features.push({
                               type: 'Feature',
                               geometry: geometry,
                               properties: {
                                   ...style,
                                   name: fence.name,
                                   id: fence.id,
                                   zoneType: 'risk_grid',
                                   riskLevel: fence.riskLevel,
                                   gridId: metadata.gridId,
                                   riskScore: metadata.riskScore,
                                   lastUpdated: metadata.lastUpdated,
                                   reasons: JSON.stringify(metadata.reasons || []),
                                   centerLat: center[0],
                                   centerLng: center[1]
                               }
                           });
                       }
                   } else {
                       // Multiple grids - create cluster circle
                       let sumLat = 0, sumLng = 0, maxRiskLevel = 'Low';
                       let maxRiskScore = 0;
                       
                       cluster.forEach(f => {
                           const center = getCenter(f);
                           sumLat += center[0];
                           sumLng += center[1];
                           const score = f.metadata?.riskScore || 0;
                           if (score > maxRiskScore) {
                               maxRiskScore = score;
                               maxRiskLevel = f.riskLevel || 'Low';
                           }
                       });
                       
                       const centroidLat = sumLat / cluster.length;
                       const centroidLng = sumLng / cluster.length;
                       const clusterRadius = 0.6; // 600m cluster radius
                       
                       const clusterCircle = turf.circle([centroidLng, centroidLat], clusterRadius, { 
                           steps: 24, 
                           units: 'kilometers' 
                       });
                       
                       const clusterStyle = getGeofenceStyle({ 
                           riskLevel: maxRiskLevel, 
                           visualStyle: { 
                               zoneType: 'risk_grid',
                               fillPattern: 'dots',
                               fillOpacity: 0.4,
                               borderStyle: 'dashed',
                               borderWidth: 2
                           }
                       });
                       
                       features.push({
                           type: 'Feature',
                           geometry: clusterCircle.geometry,
                           properties: {
                               ...clusterStyle,
                               name: maxRiskLevel + ' Risk Cluster (' + cluster.length + ')',
                               isCluster: true,
                               zoneType: 'risk_grid',
                               riskLevel: maxRiskLevel,
                               clusterSize: cluster.length,
                               centerLat: centroidLat,
                               centerLng: centroidLng
                           }
                       });
                   }
               });
               
               // Render geofence destinations with solid fill
               geofencesDestinations.forEach(fence => {
                   const geometry = createGeometry(fence);
                   if (geometry) {
                       const style = getGeofenceStyle(fence);
                       const center = getCenter(fence);
                       
                       // Extract metadata for geofences
                       const metadata = fence.metadata || {};
                       
                       features.push({
                           type: 'Feature',
                           geometry: geometry,
                           properties: {
                               ...style,
                               name: fence.name,
                               id: fence.id,
                               zoneType: 'geofence',
                               riskLevel: fence.riskLevel,
                               destination: metadata.destination,
                               alertMessage: metadata.alertMessage,
                               sourceType: metadata.sourceType,
                               dayNumber: metadata.dayNumber,
                               scheduledDate: metadata.scheduledDate,
                               activityNodeName: metadata.activityNodeName,
                               centerLat: center[0],
                               centerLng: center[1]
                           }
                       });
                   }
               });
               
               // Render other zones (legacy)
               otherZones.forEach(fence => {
                   const geometry = createGeometry(fence);
                   if (geometry) {
                       const style = getGeofenceStyle(fence);
                       const center = getCenter(fence);
                       features.push({
                           type: 'Feature',
                           geometry: geometry,
                           properties: {
                               ...style,
                               name: fence.name,
                               id: fence.id,
                               riskLevel: fence.riskLevel,
                               centerLat: center[0],
                               centerLng: center[1]
                           }
                       });
                   }
               });

               // Update map source
               const source = map.getSource('geofences');
               if (source) {
                   source.setData({ type: 'FeatureCollection', features });
               }
               
               // Legend stats now handled in React Native bottom sheet
           }
           
           // Helper to create geometry from fence
           function createGeometry(fence) {
               if (!fence.coords) return null;
               
               if (fence.type === 'circle') {
                   const center = [fence.coords[1], fence.coords[0]]; // [lng, lat]
                   const radiusKm = fence.radiusKm || 0.5;
                   return turf.circle(center, radiusKm, { steps: 32, units: 'kilometers' }).geometry;
               } else if (fence.type === 'polygon' && Array.isArray(fence.coords[0])) {
                   // Convert [lat, lng] to [lng, lat] for GeoJSON
                   const coordinates = fence.coords.map(coord => [coord[1], coord[0]]);
                   return {
                       type: 'Polygon',
                       coordinates: [coordinates]
                   };
               } else if (fence.type === 'point') {
                   // Render point as small circle
                   const center = [fence.coords[1], fence.coords[0]];
                   return turf.circle(center, 0.2, { steps: 16, units: 'kilometers' }).geometry;
               }
               
               return null;
           }
           
           // Helper to get center coordinates from fence
           function getCenter(fence) {
               if (!fence.coords) return [0, 0];
               if (Array.isArray(fence.coords[0])) {
                   // Polygon - calculate centroid
                   let sumLat = 0, sumLng = 0;
                   fence.coords.forEach(coord => {
                       sumLat += coord[0];
                       sumLng += coord[1];
                   });
                   return [sumLat / fence.coords.length, sumLng / fence.coords.length];
               }
               // Point or circle - return center
               return [fence.coords[0], fence.coords[1]];
           }
           
           // Improved clustering algorithm
           function clusterFeatures(fences, distanceKm) {
               if (!fences || fences.length === 0) return [];
               
               const clusters = [];
               const visited = new Set();
               
               fences.forEach((fence, i) => {
                   if (visited.has(i)) return;
                   
                   const cluster = [fence];
                   visited.add(i);
                   const center1 = getCenter(fence);
                   
                   fences.forEach((other, j) => {
                       if (i === j || visited.has(j)) return;
                       
                       const center2 = getCenter(other);
                       const distance = turf.distance(
                           turf.point([center1[1], center1[0]]),
                           turf.point([center2[1], center2[0]]),
                           { units: 'kilometers' }
                       );
                       
                       if (distance <= distanceKm) {
                           cluster.push(other);
                           visited.add(j);
                       }
                   });
                   
                   clusters.push(cluster);
               });
               
               return clusters;
           }
          
          function getGeofenceStyle(fence) {
              // Use backend visualStyle if available, otherwise fallback to legacy logic
              if (fence.visualStyle) {
                  const vs = fence.visualStyle;
                  
                  // Determine color based on zone type and risk level
                  let color = vs.color || '#9e9e9e';
                  
                  if (!vs.color) {
                      // Color based on risk level if not specified
                      const riskLevel = (fence.riskLevel || '').toLowerCase();
                      if (riskLevel.includes('very') && riskLevel.includes('high')) {
                          color = '#d32f2f'; // Very High: Dark Red
                      } else if (riskLevel.includes('high')) {
                          color = '#ef4444'; // High: Red
                      } else if (riskLevel.includes('medium')) {
                          color = '#f59e0b'; // Medium: Orange
                      } else if (riskLevel.includes('low')) {
                          color = '#22c55e'; // Low: Green
                          color = '#3b82f6'; // Low: Blue
                      }
                      
                      // Override color for specific zone types
                      const zoneType = vs.zoneType || '';
                      if (zoneType === 'geofence') {
                          color = '#3b82f6'; // Blue for tourist destinations
                      }
                  }
                  
                  // Force itinerary geofences to blue regardless of visualStyle.color
                  const zoneType = vs.zoneType || '';
                  if (zoneType === 'itinerary_geofence') {
                      color = '#3b82f6'; // Blue for itinerary geofences
                  }
                  
                  return {
                      fillColor: color,
                      fillOpacity: vs.fillOpacity || 0.25,
                      fillPattern: vs.fillPattern || 'solid',
                      borderColor: color,
                      borderWidth: vs.borderWidth || 2,
                      borderStyle: vs.borderStyle || 'solid',
                      iconType: vs.iconType,
                      renderPriority: vs.renderPriority || 2
                  };
              }
              
              // Legacy fallback for zones without visualStyle
              const category = (fence.category || '').toLowerCase();
              if (category.includes('police')) return { 
                  fillColor: '#6366F1', fillOpacity: 0.3, fillPattern: 'solid',
                  borderColor: '#6366F1', borderWidth: 2, borderStyle: 'solid'
              };
              if (category.includes('hospital')) return { 
                  fillColor: '#EF4444', fillOpacity: 0.3, fillPattern: 'solid',
                  borderColor: '#EF4444', borderWidth: 2, borderStyle: 'solid'
              };
              
              const l = (fence.riskLevel || '').toLowerCase();
              if (l.includes('high')) return { 
                  fillColor: '#ef4444', fillOpacity: 0.4, fillPattern: 'solid',
                  borderColor: '#ef4444', borderWidth: 2, borderStyle: 'solid'
              };
              if (l.includes('medium')) return { 
                  fillColor: '#f59e0b', fillOpacity: 0.4, fillPattern: 'solid',
                  borderColor: '#f59e0b', borderWidth: 2, borderStyle: 'solid'
              };
              return { 
                  fillColor: '#22c55e', fillOpacity: 0.2, fillPattern: 'solid',
                  borderColor: '#22c55e', borderWidth: 2, borderStyle: 'solid'
                  fillColor: '#3b82f6', fillOpacity: 0.2, fillPattern: 'solid',
                  borderColor: '#3b82f6', borderWidth: 2, borderStyle: 'solid'
              };
          }
          
           function clearAllGeoFences() {
             map.getSource('geofences')?.setData({ type: 'FeatureCollection', features: [] });
           }

           // ===== PATH DEVIATION TRACKING ENHANCEMENT =====
           ${trackingScript}
           // ===== END TRACKING ENHANCEMENT =====

      </script>
  </body>
  </html>
  `;
};

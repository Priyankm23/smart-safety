/**
 * Map Tracking Enhancement
 * Additional JavaScript to inject into the map for path deviation tracking
 */

export const getTrackingEnhancementScript = (): string => {
  return `
    // Path Deviation Tracking State
    let trackingActive = false;
    let userTrackingMarker = null;
    let deviationCircle = null;
    let userTrailLine = null;
    let userTrailPoints = [];
    
    /**
     * Initialize tracking visualization
     */
    function initializeTracking() {
      // Add source for user trail (breadcrumb trail)
      if (!map.getSource('user-trail')) {
        map.addSource('user-trail', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: []
            }
          }
        });

        // User trail line (blue trail behind user)
        map.addLayer({
          id: 'user-trail-line',
          type: 'line',
          source: 'user-trail',
          paint: {
            'line-color': '#3B82F6',
            'line-width': 4,
            'line-opacity': 0.6
          }
        });
      }

      // Add source for deviation circle
      if (!map.getSource('deviation-circle')) {
        map.addSource('deviation-circle', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [0, 0]
            }
          }
        });

        // Deviation warning circle (red circle when off-route)
        map.addLayer({
          id: 'deviation-circle-layer',
          type: 'circle',
          source: 'deviation-circle',
          paint: {
            'circle-radius': 50,
            'circle-color': '#DC2626',
            'circle-opacity': 0.2,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#DC2626',
            'circle-stroke-opacity': 0.8
          }
        });
      }

      // Create custom user tracking marker with direction indicator
      if (!userTrackingMarker) {
        const el = document.createElement('div');
        el.className = 'user-tracking-marker';
        el.innerHTML = \`
          <div class="user-marker-pulse"></div>
          <div class="user-marker-inner">
            <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="8" fill="#3B82F6" stroke="white" stroke-width="2"/>
              <path d="M10 5 L10 12 L13 10" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none"/>
            </svg>
          </div>
        \`;

        userTrackingMarker = new mapboxgl.Marker({ element: el })
          .setLngLat([0, 0]);
      }
    }

    /**
     * Start tracking mode
     */
    function startTracking() {
      trackingActive = true;
      initializeTracking();
      userTrailPoints = [];
      console.log('[Map] Tracking mode activated');
    }

    /**
     * Stop tracking mode
     */
    function stopTracking() {
      trackingActive = false;
      if (userTrackingMarker) {
        userTrackingMarker.remove();
      }
      hideDeviationCircle();
      clearUserTrail();
      console.log('[Map] Tracking mode deactivated');
    }

    /**
     * Update user tracking position
     */
    function updateUserTracking(lng, lat, bearing, speed) {
      if (!trackingActive) return;

      // Update marker position
      if (userTrackingMarker) {
        userTrackingMarker.setLngLat([lng, lat]);
        if (!userTrackingMarker._element.parentNode) {
          userTrackingMarker.addTo(map);
        }

        // Rotate marker based on bearing
        if (bearing !== undefined && bearing !== null) {
          const markerEl = userTrackingMarker.getElement();
          const svg = markerEl.querySelector('svg');
          if (svg) {
            svg.style.transform = \`rotate(\${bearing}deg)\`;
          }
        }
      }

      // Add to trail
      userTrailPoints.push([lng, lat]);
      if (userTrailPoints.length > 100) {
        userTrailPoints.shift(); // Keep last 100 points
      }

      // Update trail line
      const trailSource = map.getSource('user-trail');
      if (trailSource) {
        trailSource.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: userTrailPoints
          }
        });
      }

      // Always recenter on user during tracking to follow movement
      map.easeTo({
          center: [lng, lat],
          duration: 1000,
          essential: true
      });
    }

    /**
     * Show deviation warning circle
     */
    function showDeviationCircle(lng, lat, radius) {
      const deviationSource = map.getSource('deviation-circle');
      if (deviationSource) {
        // Create circle using turf
        const center = turf.point([lng, lat]);
        const buffered = turf.buffer(center, radius / 1000, { units: 'kilometers' });
        
        deviationSource.setData(buffered);
        
        // Make layer visible
        map.setLayoutProperty('deviation-circle-layer', 'visibility', 'visible');
      }
    }

    /**
     * Hide deviation circle
     */
    function hideDeviationCircle() {
      if (map.getLayer('deviation-circle-layer')) {
        map.setLayoutProperty('deviation-circle-layer', 'visibility', 'none');
      }
    }

    /**
     * Clear user trail
     */
    function clearUserTrail() {
      userTrailPoints = [];
      const trailSource = map.getSource('user-trail');
      if (trailSource) {
        trailSource.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        });
      }
    }

    /**
     * Re-center map on user's current location
     */
    function recenterOnUser() {
      if (!trackingActive || !userTrackingMarker) {
        return;
      }
      
      const lngLat = userTrackingMarker.getLngLat();
      map.easeTo({
        center: [lngLat.lng, lngLat.lat],
        zoom: 16,
        duration: 800,
        essential: true
      });
      console.log('[Map] Re-centered on user location');
    }

    /**
     * Highlight route probability
     */
    function highlightRouteProbability(routeIndex, probability) {
      // Update route opacity based on probability
      // This would update the route layer to show which route the user is likely on
      // Implementation depends on how routes are stored
    }

    // Add separate message handler for tracking commands
    // This is added as a NEW listener, not overriding the original
    function handleTrackingMessage(event) {
      try {
        const data = JSON.parse(event.data);
        
        // Only handle tracking-related messages
        const trackingTypes = ['startTracking', 'stopTracking', 'updateUserTracking', 
                               'showDeviation', 'hideDeviation', 'clearTrail', 'recenterOnUser'];
        
        if (!trackingTypes.includes(data.type)) {
          return; // Let other handlers deal with non-tracking messages
        }
        
        // Debug logging for tracking messages
        console.log('[Map Tracking] Received:', data.type, data.lat?.toFixed(4), data.lng?.toFixed(4));
        
        switch (data.type) {
          case 'startTracking':
            console.log('[Map Tracking] Starting tracking mode...');
            startTracking();
            break;
          case 'stopTracking':
            stopTracking();
            break;
          case 'updateUserTracking':
            console.log('[Map Tracking] Updating position:', data.lat, data.lng, 'active:', trackingActive);
            updateUserTracking(
              data.lng, 
              data.lat, 
              data.bearing, 
              data.speed
            );
            break;
          case 'showDeviation':
            showDeviationCircle(data.lng, data.lat, data.radius || 50);
            break;
          case 'hideDeviation':
            hideDeviationCircle();
            break;
          case 'clearTrail':
            clearUserTrail();
            break;
          case 'recenterOnUser':
            recenterOnUser();
            break;
        }
      } catch(e) {
        // Silently ignore parse errors - let the main handler deal with them
      }
    }
    
    // Register the tracking message handler
    document.addEventListener('message', handleTrackingMessage);
    window.addEventListener('message', handleTrackingMessage);
    console.log('[Map Tracking] Handler registered');

    // Add CSS for tracking marker
    const style = document.createElement('style');
    style.textContent = \`
      .user-tracking-marker {
        width: 40px;
        height: 40px;
        position: relative;
      }
      
      .user-marker-inner {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 2;
      }
      
      .user-marker-pulse {
        position: absolute;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: rgba(59, 130, 246, 0.3);
        animation: tracking-pulse 2s ease-out infinite;
        z-index: 1;
      }
      
      @keyframes tracking-pulse {
        0% { transform: scale(0.8); opacity: 1; }
        100% { transform: scale(2); opacity: 0; }
      }
    \`;
    document.head.appendChild(style);
  `;
};

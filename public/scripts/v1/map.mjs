export function createGeographicMap(element, { onSelect, onPin }) {
  const L = globalThis.L;
  if (!L?.map) throw new Error('The local map library is unavailable. Use the accessible stop list and reload to retry.');
  const map = L.map(element, { worldCopyJump: true, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView([35, -20], 2);
  element.setAttribute('tabindex', '0');
  const stops = L.layerGroup().addTo(map), user = L.layerGroup().addTo(map);
  let tiles = null, draft = null;
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  map.on('click', event => onPin({ latitude: event.latlng.lat.toFixed(6), longitude: L.Util.wrapNum(event.latlng.lng, [-180, 180], true).toFixed(6) }));
  return {
    render(places, selected) {
      stops.clearLayers();
      for (const place of places) {
        const latitude = Number(place.latitude), longitude = Number(place.longitude), radius = Number(place.radius);
        const chosen = place.id === selected.id;
        const icon = L.divIcon({ className: 'geo-marker-shell', html: '<span aria-hidden="true">◎</span>', iconSize: [36, 36], iconAnchor: [18, 18] });
        const marker = L.marker([latitude, longitude], { icon, keyboard: true, title: place.name }).addTo(stops);
        const button = marker.getElement();
        button.classList.add('marker'); button.setAttribute('role', 'button'); button.setAttribute('aria-label', `${place.name}${place.demo ? ', demonstration only' : ', Base deployment stop'}`);
        button.setAttribute('aria-pressed', String(chosen));
        marker.on('click', () => onSelect(place));
        marker.on('keypress', event => { if (event.originalEvent.key === ' ') { event.originalEvent.preventDefault(); onSelect(place); } });
        L.circle([latitude, longitude], { radius, color: chosen ? '#e9c477' : '#afd8b5', weight: 2, fillOpacity: .12 }).addTo(stops);
      }
    },
    focus(place) { map.setView([Number(place.latitude), Number(place.longitude)], Math.max(map.getZoom(), 15)); },
    pin(point, radius) {
      draft?.remove();
      draft = L.circle([Number(point.latitude), Number(point.longitude)], { radius, color: '#e9c477', dashArray: '5 5', fillOpacity: .18 }).addTo(map);
      map.setView([Number(point.latitude), Number(point.longitude)], Math.max(map.getZoom(), 16));
    },
    location(position) {
      user.clearLayers();
      if (position) {
        L.circle([position.latitude, position.longitude], { radius: position.accuracy, color: '#9dc8f0', weight: 1 }).addTo(user);
        L.circleMarker([position.latitude, position.longitude], { radius: 5, color: '#ffffff', fillColor: '#357bd2', fillOpacity: 1 }).addTo(user);
      }
    },
    setTiles(enabled, onError) {
      if (tiles) { map.removeLayer(tiles); tiles = null; }
      if (enabled) {
        tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, minZoom: 1,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
        tiles.on('tileerror', onError); tiles.addTo(map);
      }
    },
    destroy() { map.remove(); },
  };
}

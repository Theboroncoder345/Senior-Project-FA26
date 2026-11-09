const API_URL = import.meta.env.VITE_API_BASE_URL;

export async function searchParking(params) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) {
      query.append(key, value);
    }
  });

  const response = await fetch(
    `${API_URL}/parking/search?${query.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Parking search failed: ${response.status}`);
  }

  const data = await response.json();

  return data.parking_spots;
}

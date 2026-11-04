import { useEffect, useState } from "react";

const ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export default function DestinationSearch({ onSelect }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Mapbox Search Box session
  const [sessionToken] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        setLoading(true);

        const url = new URL(
          "https://api.mapbox.com/search/searchbox/v1/suggest"
        );

        url.searchParams.set("q", query);
        url.searchParams.set("access_token", ACCESS_TOKEN);
        url.searchParams.set("session_token", sessionToken);
        url.searchParams.set("limit", "5");

        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Search request failed");
        }

        const data = await response.json();
        setSuggestions(data.suggestions || []);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Destination search error:", error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, sessionToken]);

  async function selectDestination(suggestion) {
    try {
      const url = new URL(
        `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(
          suggestion.mapbox_id
        )}`
      );

      url.searchParams.set("access_token", ACCESS_TOKEN);
      url.searchParams.set("session_token", sessionToken);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Could not retrieve destination");
      }

      const data = await response.json();
      const feature = data.features[0];

      const [longitude, latitude] = feature.geometry.coordinates;

      onSelect({
        name: suggestion.name,
        address:
          suggestion.full_address ||
          suggestion.place_formatted ||
          suggestion.name,
        longitude,
        latitude,
      });

      setQuery(
        suggestion.full_address || 
        suggestion.name
      );

      setSuggestions([]);
    } catch (error) {
      console.error("Destination selection error:", error);
    }
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        placeholder="Enter a destination..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          boxSizing: "border-box",
        }}
      />

      {loading && <p>Searching...</p>}

      {suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            width: "100%",
            background: "white",
            border: "1px solid #ddd",
            borderRadius: "8px",
            zIndex: 10,
          }}
        >
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.mapbox_id}
              onClick={() => selectDestination(suggestion)}
              style={{
                padding: "12px",
                cursor: "pointer",
                borderBottom: "1px solid #eee",
              }}
            >
              <strong>{suggestion.name}</strong>
              <div>{suggestion.place_formatted}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

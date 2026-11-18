import { useEffect, useState } from "react";

const ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export default function DestinationSearch({ onSelect, onQueryChange, inputClassName, id, placeholder = "Enter a destination..." }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedQuery, setSelectedQuery] = useState("");

  // Mapbox Search Box session
  const [sessionToken, setSessionToken] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (query.trim().length < 3 || query === selectedQuery) return;

    const controller = new AbortController();

    const timeout = setTimeout(async () => {
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
          setError("Address suggestions are unavailable. You can still enter an address.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 500);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, selectedQuery, sessionToken]);

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

      const address = feature.properties?.full_address || suggestion.full_address
        || [suggestion.name, suggestion.place_formatted].filter(Boolean).join(", ");
      onSelect({ name: suggestion.name, address, longitude, latitude });

      setQuery(address);
      setSelectedQuery(address);
      setSessionToken(crypto.randomUUID());
      setSuggestions([]);
      setLoading(false);
      setError("");
    } catch {
      setError("Could not select that address. You can still enter it manually.");
    }
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        id={id}
        type="text"
        className={inputClassName}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedQuery("");
          setLoading(false);
          setSuggestions([]);
          setError("");
          onQueryChange?.(e.target.value);
        }}
      />

      {loading && <p role="status">Searching...</p>}
      {error && <p role="status">{error}</p>}

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

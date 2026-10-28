export function ExplodeSlider({
  value,
  onChange,
  onAssemble,
}: {
  value: number;
  onChange: (value: number) => void;
  onAssemble: () => void;
}) {
  return (
    <div className="explode-slider">
      <button type="button" onClick={onAssemble}>
        Rebuild
      </button>
      <label htmlFor="explode-viewer">
        <span>Exploded view</span>
        <output>{Math.round(value * 100)} %</output>
      </label>
      <input
        id="explode-viewer"
        type="range"
        min="0"
        max="1"
        step="0.02"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={`${Math.round(value * 100)}% separated`}
      />
    </div>
  );
}

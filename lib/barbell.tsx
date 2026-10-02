// App icon: barbell, size n ke hisaab se scale
export function Barbell({ n }: { n: number }) {
  const plate = (h: number) => <div style={{ width: n * 0.07, height: n * h, background: "#fff", borderRadius: n * 0.02 }} />;
  return (
    <div style={{ width: "100%", height: "100%", background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {plate(0.36)}<div style={{ width: n * 0.02 }} />{plate(0.26)}
      <div style={{ width: n * 0.2, height: n * 0.05, background: "#fff" }} />
      {plate(0.26)}<div style={{ width: n * 0.02 }} />{plate(0.36)}
    </div>
  );
}

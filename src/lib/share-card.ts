export function downloadShareCard(opts: {
  name: string;
  occasion: string;
  date: string;
  items: { name: string; amount: number; isShared: boolean }[];
  total: number;
  color: string;
}) {
  const width = 720;
  const rows = Math.min(opts.items.length, 8);
  const height = 220 + rows * 36 + 90;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#F6F1EA";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 32, 32, width - 64, height - 64, 28);
  ctx.fill();
  ctx.fillStyle = opts.color;
  ctx.fillRect(32, 32, width - 64, 8);

  ctx.fillStyle = "#1c1917";
  ctx.font = "800 36px system-ui, sans-serif";
  ctx.fillText(opts.name, 56, 100);
  ctx.fillStyle = "#6f6a64";
  ctx.font = "500 20px system-ui, sans-serif";
  ctx.fillText(`${opts.occasion} · ${opts.date}`, 56, 132);

  opts.items.slice(0, 8).forEach((it, i) => {
    const y = 180 + i * 36;
    ctx.fillStyle = it.isShared ? "#C4452D" : "#5c5752";
    ctx.font = "600 20px system-ui, sans-serif";
    const label = `${it.isShared ? "⇌ " : ""}${it.name}`;
    ctx.fillText(label.slice(0, 32), 56, y);
    ctx.font = "700 20px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillText(it.amount.toFixed(2), width - 56, y);
    ctx.textAlign = "left";
  });

  ctx.fillStyle = "rgba(196,69,45,0.12)";
  roundRect(ctx, 48, height - 120, width - 96, 56, 14);
  ctx.fill();
  ctx.fillStyle = "#1c1917";
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.fillText("Total", 72, height - 82);
  ctx.fillStyle = opts.color;
  ctx.font = "800 22px ui-monospace, monospace";
  ctx.textAlign = "right";
  ctx.fillText(`SGD ${opts.total.toFixed(2)}`, width - 72, height - 82);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${opts.name.replace(/\s+/g, "-")}-splittab.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

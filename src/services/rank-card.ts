import { createCanvas, loadImage, type Image, type SKRSContext2D } from '@napi-rs/canvas';

interface RankCardData {
  username: string;
  displayName: string;
  avatarUrl: string;
  level: number;
  rank: number;
  xpIntoLevel: number;
  xpNeeded: number;
  totalXp: number;
  totalMessages: number;
}

const WIDTH = 934;
const HEIGHT = 330;

const COLORS = {
  bg: '#1a1a2e',
  cardBg: '#16213e',
  accent: '#e8713a',
  accentDark: '#c45a28',
  barBg: '#0f3460',
  text: '#ffffff',
  textDim: '#8892a4',
  textMuted: '#5a6377',
};

function roundRect(
  ctx: SKRSContext2D,
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

function drawCircularImage(
  ctx: SKRSContext2D,
  img: Image,
  x: number,
  y: number,
  size: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

// Use type returned by loadImage
type CanvasImage = Awaited<ReturnType<typeof loadImage>>;

export async function generateRankCard(data: RankCardData): Promise<Buffer> {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background with gradient
  const bgGrad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bgGrad.addColorStop(0, COLORS.bg);
  bgGrad.addColorStop(1, COLORS.cardBg);
  roundRect(ctx, 0, 0, WIDTH, HEIGHT, 20);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // Subtle accent glow in top-right
  const glow = ctx.createRadialGradient(WIDTH - 100, 50, 10, WIDTH - 100, 50, 250);
  glow.addColorStop(0, 'rgba(232, 113, 58, 0.15)');
  glow.addColorStop(1, 'rgba(232, 113, 58, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Border
  roundRect(ctx, 0, 0, WIDTH, HEIGHT, 20);
  ctx.strokeStyle = 'rgba(232, 113, 58, 0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Avatar
  const avatarSize = 210;
  const avatarX = 40;
  const avatarY = (HEIGHT - avatarSize) / 2;

  let avatarImg: CanvasImage;
  try {
    avatarImg = await loadImage(data.avatarUrl);
  } catch {
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.accent;
    ctx.fill();
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 80px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.username[0].toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2);
    avatarImg = null as unknown as CanvasImage;
  }

  // Avatar ring
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2);
  const ringGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
  ringGrad.addColorStop(0, COLORS.accent);
  ringGrad.addColorStop(1, COLORS.accentDark);
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = 5;
  ctx.stroke();

  if (avatarImg) {
    drawCircularImage(ctx, avatarImg as any, avatarX, avatarY, avatarSize);
  }

  // Content area
  const contentX = avatarX + avatarSize + 30;
  const contentW = WIDTH - contentX - 40;

  // Pre-measure the right-side RANK/LEVEL badge group so we know exactly
  // where it starts. The group is right-anchored at (WIDTH - 40) and grows
  // leftward based on digit counts, so its left edge varies with rank/level.
  const badgeRight = WIDTH - 40;
  const badgeY = 22;
  ctx.font = 'bold 56px sans-serif';
  const levelStr = `${data.level}`;
  const rankStr = `#${data.rank}`;
  const levelNumW = ctx.measureText(levelStr).width;
  const rankNumW = ctx.measureText(rankStr).width;
  ctx.font = 'bold 24px sans-serif';
  const levelLabelW = ctx.measureText('LEVEL ').width;
  const rankLabelW = ctx.measureText('RANK ').width;
  // Leftmost x of any glyph in the badge group:
  const badgeGroupLeft =
    badgeRight - levelNumW - levelLabelW - 28 - rankNumW - rankLabelW;

  // Username and display name — step down through sizes until it fits
  // within (badgeGroupLeft − NAME_BADGE_GAP). The gap is the visible
  // clearance between the longest possible name and the start of the badges.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = COLORS.text;

  const NAME_BADGE_GAP = 25;
  const maxNameWidth = badgeGroupLeft - contentX - NAME_BADGE_GAP;

  const name = data.displayName || data.username;
  const nameSizes = [44, 42, 40, 38, 36, 32, 28, 24];
  let nameSize = nameSizes[nameSizes.length - 1];
  for (const size of nameSizes) {
    ctx.font = `bold ${size}px sans-serif`;
    if (ctx.measureText(name).width <= maxNameWidth) {
      nameSize = size;
      break;
    }
  }
  ctx.font = `bold ${nameSize}px sans-serif`;

  // Truncate with ellipsis if even the smallest size overflows
  let displayName = name;
  if (ctx.measureText(displayName).width > maxNameWidth) {
    while (displayName.length > 0 && ctx.measureText(displayName + '…').width > maxNameWidth) {
      displayName = displayName.slice(0, -1);
    }
    displayName += '…';
  }
  ctx.fillText(displayName, contentX, 25);

  // Username (if different from display name)
  if (data.displayName && data.displayName !== data.username) {
    ctx.font = '26px sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(`@${data.username}`, contentX, 76);
  }

  // Rank and Level badges (right side) — widths pre-measured above.
  ctx.textAlign = 'right';

  // Level
  ctx.font = 'bold 56px sans-serif';
  ctx.fillStyle = COLORS.accent;
  ctx.fillText(levelStr, badgeRight, badgeY);
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('LEVEL ', badgeRight - levelNumW - 4, badgeY + 26);

  // Rank
  ctx.font = 'bold 56px sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(rankStr, badgeRight - levelNumW - levelLabelW - 24, badgeY);
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('RANK ', badgeRight - levelNumW - levelLabelW - rankNumW - 28, badgeY + 26);

  // Stats row — nudged right toward center of content area
  const statsY = 130;
  ctx.textAlign = 'left';
  const statsOffset = 20;

  const stats = [
    { label: 'MESSAGES', value: formatNumber(data.totalMessages) },
    { label: 'TOTAL XP', value: formatNumber(data.totalXp) },
  ];

  let statX = contentX + statsOffset;
  for (const stat of stats) {
    ctx.font = '20px sans-serif';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText(stat.label, statX, statsY);

    ctx.font = 'bold 32px sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(stat.value, statX, statsY + 26);

    statX += 190;
  }

  // XP progress text (above bar with clear gap)
  const barY = 250;
  ctx.textAlign = 'right';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(
    `${formatNumber(data.xpIntoLevel)} / ${formatNumber(data.xpNeeded)} XP`,
    contentX + contentW,
    barY - 36,
  );

  // Progress bar background
  const barHeight = 36;
  const barRadius = barHeight / 2;
  roundRect(ctx, contentX, barY, contentW, barHeight, barRadius);
  ctx.fillStyle = COLORS.barBg;
  ctx.fill();

  // Progress bar fill
  const progress = Math.max(data.xpIntoLevel / data.xpNeeded, 0.02);
  const fillWidth = Math.max(contentW * progress, barHeight);
  roundRect(ctx, contentX, barY, fillWidth, barHeight, barRadius);
  const barGrad = ctx.createLinearGradient(contentX, barY, contentX + fillWidth, barY);
  barGrad.addColorStop(0, COLORS.accentDark);
  barGrad.addColorStop(1, COLORS.accent);
  ctx.fillStyle = barGrad;
  ctx.fill();

  // Progress percentage in bar
  const percent = Math.round((data.xpIntoLevel / data.xpNeeded) * 100);
  if (fillWidth > 65) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`${percent}%`, contentX + fillWidth / 2, barY + 9);
  }

  // Bottom accent line
  roundRect(ctx, 40, HEIGHT - 8, WIDTH - 80, 3, 1.5);
  const lineGrad = ctx.createLinearGradient(40, 0, WIDTH - 40, 0);
  lineGrad.addColorStop(0, 'rgba(232, 113, 58, 0)');
  lineGrad.addColorStop(0.5, 'rgba(232, 113, 58, 0.5)');
  lineGrad.addColorStop(1, 'rgba(232, 113, 58, 0)');
  ctx.fillStyle = lineGrad;
  ctx.fill();

  return canvas.toBuffer('image/png');
}

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE_IMAGE = 'C:/Users/parth/.gemini/antigravity-ide/brain/257d1afc-2b66-47bd-8633-00b2cbf95db5/.user_uploaded/media_1789639044371.png';
const ROOT_DIR = path.resolve(__dirname, '..');

// Helper to make directory if not exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Helper to build a multi-resolution ICO file
function createIco(pngBuffers, sizes) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(count, 4);

  let offset = 6 + count * 16;
  const entries = [];
  for (let i = 0; i < count; i++) {
    const s = sizes[i];
    const buf = pngBuffers[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(s >= 256 ? 0 : s, 0); // width
    entry.writeUInt8(s >= 256 ? 0 : s, 1); // height
    entry.writeUInt8(0, 2); // color palette count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buf.length, 8); // image size
    entry.writeUInt32LE(offset, 12); // image offset
    offset += buf.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...pngBuffers]);
}

async function run() {
  console.log('Loading source logo from:', SOURCE_IMAGE);
  const src = sharp(SOURCE_IMAGE);
  const metadata = await src.metadata();
  console.log(`Source image dimensions: ${metadata.width}x${metadata.height}`);

  // Create high-res 1024x1024 centered master with pure white background
  const master1024Buffer = await sharp(SOURCE_IMAGE)
    .resize(920, 920, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .extend({
      top: 52,
      bottom: 52,
      left: 52,
      right: 52,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();

  // Create transparent version: convert pure white background to alpha 0 with smooth anti-aliased edges
  const rawMaster = await sharp(master1024Buffer).raw().toBuffer({ resolveWithObject: true });
  const { data, info } = rawMaster;
  const transData = Buffer.from(data);
  const totalPixels = info.width * info.height;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = transData[idx];
    const g = transData[idx + 1];
    const b = transData[idx + 2];
    const minVal = Math.min(r, g, b);

    if (minVal >= 252) {
      transData[idx + 3] = 0;
    } else if (minVal >= 235) {
      const alphaFactor = (255 - minVal) / 20;
      transData[idx + 3] = Math.max(0, Math.min(255, Math.round(alphaFactor * 255)));
    }
  }

  const masterTransparentBuffer = await sharp(transData, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();

  // 1. Resources master files
  ensureDir(path.join(ROOT_DIR, 'resources'));
  fs.writeFileSync(path.join(ROOT_DIR, 'resources', 'icon.png'), master1024Buffer);
  fs.writeFileSync(path.join(ROOT_DIR, 'resources', 'logo.png'), master1024Buffer);
  fs.writeFileSync(path.join(ROOT_DIR, 'resources', 'icon-only.png'), master1024Buffer);
  console.log('✓ Saved resources/icon.png and resources/logo.png');

  // Master splash (2732x2732)
  const splashMaster = await sharp({
    create: {
      width: 2732,
      height: 2732,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      {
        input: await sharp(master1024Buffer).resize(900, 900).toBuffer(),
        gravity: 'center',
      },
    ])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(ROOT_DIR, 'resources', 'splash.png'), splashMaster);
  console.log('✓ Saved resources/splash.png');

  // 2. Public web assets
  ensureDir(path.join(ROOT_DIR, 'public'));
  ensureDir(path.join(ROOT_DIR, 'public', 'icons'));
  ensureDir(path.join(ROOT_DIR, 'public', 'images'));

  const logo512 = await sharp(master1024Buffer).resize(512, 512).png().toBuffer();
  fs.writeFileSync(path.join(ROOT_DIR, 'public', 'logo.png'), logo512);
  fs.writeFileSync(path.join(ROOT_DIR, 'public', 'images', 'logo.png'), logo512);

  const logoTrans512 = await sharp(masterTransparentBuffer).resize(512, 512).png().toBuffer();
  fs.writeFileSync(path.join(ROOT_DIR, 'public', 'logo-transparent.png'), logoTrans512);
  fs.writeFileSync(path.join(ROOT_DIR, 'public', 'images', 'logo-transparent.png'), logoTrans512);

  // PWA icons
  const icon192 = await sharp(master1024Buffer).resize(192, 192).png().toBuffer();
  fs.writeFileSync(path.join(ROOT_DIR, 'public', 'icons', 'icon-192.png'), icon192);
  fs.writeFileSync(path.join(ROOT_DIR, 'public', 'icons', 'icon-512.png'), logo512);
  console.log('✓ Saved public/logo.png, public/logo-transparent.png, public/icons/icon-192.png, icon-512.png');

  // Next.js app icons
  ensureDir(path.join(ROOT_DIR, 'src', 'app'));
  fs.writeFileSync(path.join(ROOT_DIR, 'src', 'app', 'icon.png'), icon192);

  const appleIcon = await sharp(master1024Buffer).resize(180, 180).png().toBuffer();
  fs.writeFileSync(path.join(ROOT_DIR, 'src', 'app', 'apple-icon.png'), appleIcon);

  // Favicons (.ico multi-size 16, 32, 48)
  const icoSizes = [16, 32, 48];
  const icoBuffers = await Promise.all(
    icoSizes.map((s) => sharp(master1024Buffer).resize(s, s).png().toBuffer())
  );
  const icoFile = createIco(icoBuffers, icoSizes);
  fs.writeFileSync(path.join(ROOT_DIR, 'src', 'app', 'favicon.ico'), icoFile);
  fs.writeFileSync(path.join(ROOT_DIR, 'public', 'favicon.ico'), icoFile);
  console.log('✓ Saved src/app/favicon.ico and public/favicon.ico');

  // 3. Android mipmap icons
  const mipmaps = [
    { name: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
    { name: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
    { name: 'mipmap-xhdpi', iconSize: 96, fgSize: 216 },
    { name: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324 },
    { name: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432 },
  ];

  const resBase = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res');

  for (const m of mipmaps) {
    const dir = path.join(resBase, m.name);
    ensureDir(dir);

    // ic_launcher.png (legacy)
    const icon = await sharp(master1024Buffer).resize(m.iconSize, m.iconSize).png().toBuffer();
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), icon);
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), icon);

    // Adaptive icon foreground: sits in center ~68% safe zone of the fg canvas
    const safeLogoSize = Math.round(m.fgSize * 0.68);
    const scaledLogo = await sharp(masterTransparentBuffer).resize(safeLogoSize, safeLogoSize).png().toBuffer();

    const fg = await sharp({
      create: {
        width: m.fgSize,
        height: m.fgSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: scaledLogo, gravity: 'center' }])
      .png()
      .toBuffer();

    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), fg);
    console.log(`✓ Generated ${m.name} icons`);
  }

  // 4. Android splash screens
  const splashTargets = [
    { dir: 'drawable', width: 480, height: 320 },
    { dir: 'drawable-land-mdpi', width: 480, height: 320 },
    { dir: 'drawable-land-hdpi', width: 800, height: 480 },
    { dir: 'drawable-land-xhdpi', width: 1280, height: 720 },
    { dir: 'drawable-land-xxhdpi', width: 1600, height: 960 },
    { dir: 'drawable-land-xxxhdpi', width: 1920, height: 1280 },
    { dir: 'drawable-port-mdpi', width: 320, height: 480 },
    { dir: 'drawable-port-hdpi', width: 480, height: 800 },
    { dir: 'drawable-port-xhdpi', width: 720, height: 1280 },
    { dir: 'drawable-port-xxhdpi', width: 960, height: 1600 },
    { dir: 'drawable-port-xxxhdpi', width: 1280, height: 1920 },
  ];

  for (const s of splashTargets) {
    const dir = path.join(resBase, s.dir);
    ensureDir(dir);
    const minDim = Math.min(s.width, s.height);
    // Logo should occupy ~40-45% of minimum dimension for a beautiful centered splash
    const logoSize = Math.round(minDim * 0.42);
    const resizedLogo = await sharp(master1024Buffer).resize(logoSize, logoSize).png().toBuffer();

    const splashImg = await sharp({
      create: {
        width: s.width,
        height: s.height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([{ input: resizedLogo, gravity: 'center' }])
      .png()
      .toBuffer();

    fs.writeFileSync(path.join(dir, 'splash.png'), splashImg);
    console.log(`✓ Generated splash for ${s.dir} (${s.width}x${s.height})`);
  }

  console.log('\nAll assets generated successfully!');
}

run().catch((err) => {
  console.error('Error generating assets:', err);
  process.exit(1);
});

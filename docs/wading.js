// Wading stilts along the bottom of every page: an indigo-dyed band of water
// with black-winged stilts that feed, wander about and leave ripples. Inspired
// by the cloth "冬行鳥 (The Wintering Bird)" seen in an exhibition in Taipei.
//
// Performance: everything expensive happens once, up front. The water texture
// is rendered to a bitmap and used as a CSS background, the birds' rough
// outlines are baked into their paths and their grain comes from pre-rendered
// pattern tiles. There are no live SVG filters, which Firefox would otherwise
// re-run on every animation frame.
(function () {
	"use strict";

	var wrap = document.querySelector(".wading");
	if (!wrap) return;
	var svg = wrap.querySelector("svg");
	var NS = "http://www.w3.org/2000/svg";
	var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

	var motion = !reducedMotion.matches;
	var visible = true;
	var birds = [];
	var layers = {};
	var W = 0, H = 0;
	var uid = 0;

	function el(name, attrs, parent) {
		var e = document.createElementNS(NS, name);
		for (var k in attrs) e.setAttribute(k, attrs[k]);
		if (parent) parent.appendChild(e);
		return e;
	}
	function rand(a, b) { return a + Math.random() * (b - a); }
	function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

	// ------------------------------------------------------------- Water
	// How opaque the water is at (x, y): fades out towards the top along a
	// smooth S-curve (a piecewise-linear ramp shows a visible "edge" at each
	// kink), and the fade reaches further down towards the sides, rounding
	// off the corners so the band reads as a pool rather than a box.
	function smootherstep(t) {
		t = Math.max(0, Math.min(1, t));
		return t * t * t * (t * (t * 6 - 15) + 10);
	}
	function waterFade(x, y, w, h) {
		var u = Math.abs(2 * x / w - 1);
		return smootherstep((y - h * 0.3 * u * u * u) / (h * 0.6));
	}

	// Gradient + indigo-cloth mottling + woven threads. Rendered once per
	// size/theme into a PNG background; the fade is applied in renderWater.
	// With `masked`, the SVG fades itself (fallback when we can't post-process).
	function waterSVG(w, h, scale, masked) {
		var top = css("--water-top"), bottom = css("--water-bottom"), mottle = css("--water-mottle") || "0.3";
		var cm = function (rgb, a, b) {
			return '<feColorMatrix type="matrix" values="0 0 0 0 ' + rgb[0] + ' 0 0 0 0 ' + rgb[1] + ' 0 0 0 0 ' + rgb[2] + ' ' + a + ' 0 0 0 ' + b + '"/>';
		};
		var turb = function (freq, oct, seed) {
			return '<feTurbulence type="fractalNoise" baseFrequency="' + freq + '" numOctaves="' + oct + '" seed="' + seed + '"/>';
		};
		var layer = function (name, freq, oct, seed, rgb, a, b) {
			return '<filter id="' + name + '" x="0" y="0" width="100%" height="100%">' + turb(freq, oct, seed) + cm(rgb, a, b) + '</filter>';
		};
		var rect = '<rect width="' + w + '" height="' + h + '"';
		var fadeStops = function () {
			var out = "";
			for (var i = 0; i <= 12; i++) {
				out += '<stop offset="' + (i / 12).toFixed(3) + '" stop-color="#fff" stop-opacity="' +
					waterFade(w / 2, h * i / 12, w, h).toFixed(3) + '"/>';
			}
			return out;
		};
		return '<svg xmlns="' + NS + '" width="' + Math.round(w * scale) + '" height="' + Math.round(h * scale) +
			'" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none"><defs>' +
			'<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + top + '"/><stop offset="1" stop-color="' + bottom + '"/></linearGradient>' +
			'<linearGradient id="f" x1="0" y1="0" x2="0" y2="1">' + fadeStops() + '</linearGradient>' +
			'<mask id="m" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#f)"/></mask>' +
			layer("blotch", "0.0035 0.028", 3, 7, [1, 1, 1], 1.6, -0.72) +
			layer("weft", "0.012 0.75", 2, 9, [1, 1, 1], 1.4, -0.62) +
			layer("warp", "0.75 0.012", 2, 13, [0.1, 0.15, 0.25], 1.2, -0.55) +
			layer("grain", "0.9", 1, 2, [0.1, 0.15, 0.25], 0.9, -0.32) +
			'</defs><g' + (masked ? ' mask="url(#m)"' : '') + '>' + rect + ' fill="url(#g)"/><g opacity="' + mottle + '">' +
			rect + ' filter="url(#blotch)"/>' + rect + ' filter="url(#weft)"/>' +
			rect + ' filter="url(#warp)"/>' + rect + ' filter="url(#grain)"/></g></g></svg>';
	}

	var waterToken = 0, waterUrl = null;
	function renderWater() {
		var w = W, h = H, token = ++waterToken;
		if (!w || !h) return;
		var scale = Math.min(window.devicePixelRatio || 1, 2);
		var svgUrl = function (masked) {
			return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(waterSVG(w, h, scale, masked));
		};
		var img = new Image();
		img.onload = function () {
			if (token !== waterToken) return;
			try {
				var cv = document.createElement("canvas");
				var cw = cv.width = Math.round(w * scale), ch = cv.height = Math.round(h * scale);
				var ctx = cv.getContext("2d");
				ctx.drawImage(img, 0, 0, cw, ch);
				// Apply the fade with a little triangular dither: a slow 8-bit
				// alpha ramp over a dark page otherwise shows visible bands.
				var data = ctx.getImageData(0, 0, cw, ch), d = data.data;
				for (var y = 0; y < ch; y++) {
					for (var x = 0; x < cw; x++) {
						var a = waterFade(x / scale, y / scale, w, h) * 255 + Math.random() + Math.random() - 1;
						d[(y * cw + x) * 4 + 3] = a < 0 ? 0 : a > 255 ? 255 : a;
					}
				}
				ctx.putImageData(data, 0, 0);
				cv.toBlob(function (blob) {
					if (token === waterToken) setWater(blob ? URL.createObjectURL(blob) : svgUrl(true));
				});
			} catch (e) {
				setWater(svgUrl(true));
			}
		};
		img.src = svgUrl(false);
	}
	function setWater(url) {
		if (waterUrl && waterUrl.indexOf("blob:") === 0) URL.revokeObjectURL(waterUrl);
		waterUrl = url;
		wrap.style.backgroundImage = 'url("' + url + '")';
	}

	// ------------------------------------------------------------- Textures
	// Tileable grain for the birds: dark speckle on the white plumage and
	// lighter dry-brush streaks on the black. Used as SVG pattern fills, in
	// each bird's own coordinates, so the grain moves with the bird.
	var TEX_W = 96, TEX_H = 48, TEX_RES = 3, TEX_VARIANTS = 3;

	// Small seeded PRNG, so a theme switch redraws the same grain in new colours.
	function prng(seed) {
		return function () {
			seed = (seed + 0x6D2B79F5) | 0;
			var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	// Tileable value noise on a cx×cy grid, sampled with u, v in [0, 1).
	function smoothNoise(cx, cy, rnd) {
		var g = new Float32Array(cx * cy);
		for (var i = 0; i < g.length; i++) g[i] = rnd();
		function at(i, j) { return g[(j % cy) * cx + (i % cx)]; }
		return function (u, v) {
			var x = u * cx, y = v * cy, x0 = Math.floor(x), y0 = Math.floor(y);
			var fx = x - x0, fy = y - y0;
			fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
			var a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
			var b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
			return a + (b - a) * fy;
		};
	}

	function toRGB(colour) {
		var ctx = document.createElement("canvas").getContext("2d");
		ctx.fillStyle = colour;
		var hex = ctx.fillStyle; // normalised to #rrggbb
		return [1, 3, 5].map(function (i) { return parseInt(hex.substr(i, 2), 16); });
	}

	// Draw fn(dx, dy) at every tile offset that can reach into the tile, so
	// marks crossing an edge continue on the opposite side.
	function wrapped(fn) {
		for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) fn(dx * TEX_W, dy * TEX_H);
	}

	function texture(kind, v, colour) {
		var rnd = prng(1009 + v * 7919 + (kind === "ink" ? 31 : 0));
		var R = TEX_RES, w = TEX_W * R, h = TEX_H * R;
		var cv = document.createElement("canvas");
		cv.width = w; cv.height = h;
		var ctx = cv.getContext("2d"), rgb = toRGB(colour);
		var rgba = function (a) { return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + a.toFixed(3) + ")"; };

		// Broad, soft unevenness in how much dye took.
		var tone = kind === "body" ? smoothNoise(6, 3, rnd) : smoothNoise(3, 12, rnd);
		var img = ctx.createImageData(w, h), d = img.data;
		for (var y = 0; y < h; y++) {
			for (var x = 0; x < w; x++) {
				var n = tone(x / w, y / h);
				var a = kind === "body" ? Math.max(0, n - 0.5) * 0.28 : Math.max(0, n - 0.6) * 0.7;
				var i = (y * w + x) * 4;
				d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = a * 255;
			}
		}
		ctx.putImageData(img, 0, 0);
		ctx.scale(R, R);

		if (kind === "body") {
			// Ink specks: round, soft, of varying size.
			for (var k = 0; k < 110; k++) {
				var sx = rnd() * TEX_W, sy = rnd() * TEX_H;
				var r = 0.12 + Math.pow(rnd(), 3) * 0.45, al = 0.2 + rnd() * 0.5;
				ctx.fillStyle = rgba(al);
				wrapped(function (dx, dy) {
					ctx.beginPath(); ctx.arc(sx + dx, sy + dy, r, 0, 6.2832); ctx.fill();
				});
			}
		} else {
			// Dry-brush bristle marks running along the wing (which slopes down
			// towards the tail), some broken where the brush skipped.
			ctx.lineCap = "round";
			for (k = 0; k < 70; k++) {
				var bx = rnd() * TEX_W, by = rnd() * TEX_H, len = 6 + rnd() * 30;
				var slope = 0.12 + rnd() * 0.1, gap = rnd() < 0.4 ? 0.35 + rnd() * 0.3 : 2;
				ctx.lineWidth = 0.2 + rnd() * 0.45;
				ctx.strokeStyle = rgba(0.1 + rnd() * 0.25);
				wrapped(function (dx, dy) {
					ctx.beginPath();
					ctx.moveTo(bx + dx, by + dy);
					if (gap < 1) {
						ctx.lineTo(bx + dx + len * gap, by + dy - len * gap * slope);
						ctx.moveTo(bx + dx + len * (gap + 0.12), by + dy - len * (gap + 0.12) * slope);
					}
					ctx.lineTo(bx + dx + len, by + dy - len * slope);
					ctx.stroke();
				});
			}
		}
		return cv.toDataURL();
	}

	function buildPatterns(defs) {
		for (var v = 0; v < TEX_VARIANTS; v++) {
			["body", "ink"].forEach(function (kind) {
				var p = el("pattern", { id: "wading-" + kind + "-" + v, patternUnits: "userSpaceOnUse",
					width: TEX_W, height: TEX_H, x: rand(0, TEX_W), y: rand(0, TEX_H) }, defs);
				el("rect", { class: "wading-fill-" + kind, width: TEX_W, height: TEX_H }, p);
				el("image", { class: "wading-tex", "data-kind": kind, "data-variant": v,
					width: TEX_W, height: TEX_H, preserveAspectRatio: "none" }, p);
			});
		}
	}

	function paintTextures() {
		var ink = css("--bird-ink"), body = css("--bird-body");
		svg.querySelectorAll(".wading-tex").forEach(function (img) {
			var kind = img.getAttribute("data-kind");
			img.setAttribute("href", texture(kind, +img.getAttribute("data-variant"), kind === "body" ? ink : body));
		});
	}

	// ------------------------------------------------------------- Bird shapes
	// Drawn facing right. y=0 is the waterline; the birds are wading, so the
	// legs carry on below it and fade out. Units are px at size 1.
	//
	// Like the painted birds, each one is built from brush marks rather than
	// outlined shapes: a ragged black wing made of overlapping strokes with
	// feather tips trailing into the white, broken contour strokes, small
	// feather marks on the breast and neck, and brushed legs. Body plans vary
	// (plump and hunched, slender, long-necked...). All of it is generated
	// once per variant; each colour is a single merged path.
	var HIP = 42;                     // hip height above the waterline
	var DEPTH = 14;                   // how deep the feet are
	var THIGH = 22, SHIN = 36;
	var HIPS = { front: 2, back: -3 };
	var NECK = { x: 11, y: -13 };     // neck base, relative to the hip
	var BIRD_VARIANTS = 6;

	// Base outlines: body in hip coordinates, neck + head in neck-base
	// coordinates. Above HEAD_SPLIT is the head, below it the neck.
	var BODY = "M15,-12 C16,-4 7,2 -4,1.5 C-14,1 -22,-2 -30,-6.5 C-21,-12 -10,-17 2,-17.5 C10,-17.5 14.5,-15 15,-12 Z";
	var NECK_HEAD = "M-4,1 C-3,-9 0,-18 1.5,-23.5 C1,-27.5 4,-30.6 7.5,-30.4 C11,-30.2 13,-27.2 12,-24 C10.8,-21.8 8.5,-21.4 7.4,-19.5 C6,-12 5,-5 5,1.5 Z";
	var HEAD_SPLIT = -22;

	// Body plans: x/y scale, back hump, tail length, neck length.
	var MORPHS = [
		{ sx: 1, sy: 1, hump: 0, tail: 1, neck: 1 },
		{ sx: 0.94, sy: 1.22, hump: 2.5, tail: 0.92, neck: 0.8 },   // plump, hunched
		{ sx: 1.06, sy: 0.9, hump: 0, tail: 1.08, neck: 1.14 },     // slender
		{ sx: 1, sy: 1.1, hump: 1.5, tail: 1, neck: 0.95 },
		{ sx: 1.03, sy: 0.96, hump: 0.5, tail: 1.15, neck: 1.06 },  // long-tailed
		{ sx: 0.98, sy: 1.16, hump: 3, tail: 0.95, neck: 0.88 }
	];

	function bodyMap(m) {
		return function (p) {
			var hump = m.hump * Math.exp(-Math.pow((p.x + 4) / 14, 2)) * Math.max(0, Math.min(1, (-p.y - 6) / 10));
			return { x: p.x * m.sx * (p.x < 0 ? m.tail : 1), y: p.y * m.sy - hump };
		};
	}
	function neckMap(m) {
		return function (p) {
			return { x: p.x, y: p.y > HEAD_SPLIT ? p.y * m.neck : p.y + HEAD_SPLIT * (m.neck - 1) };
		};
	}

	function toPath(pts, closed) {
		var out = "";
		for (var i = 0; i < pts.length; i++) out += (i ? "L" : "M") + pts[i].x.toFixed(2) + "," + pts[i].y.toFixed(2);
		return out + (closed === false ? "" : "Z");
	}

	function samplePath(d, scratch, step) {
		var p = el("path", { d: d }, scratch);
		var L = p.getTotalLength(), n = Math.max(16, Math.round(L / step)), pts = [];
		for (var i = 0; i < n; i++) {
			var q = p.getPointAtLength(L * i / n);
			pts.push({ x: q.x, y: q.y });
		}
		p.remove();
		return pts;
	}

	// Offset a closed outline along its normal by a wobbling amount, so the
	// edge looks pressed rather than drawn.
	function roughen(pts, amp) {
		var n = pts.length, out = [];
		var k1 = Math.max(1, Math.round(n / 9)), k2 = Math.max(2, Math.round(n / 3)), p1 = rand(0, 6.28), p2 = rand(0, 6.28);
		for (var i = 0; i < n; i++) {
			var a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
			var tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1, t = i / n * 6.2832;
			var off = amp * (0.65 * Math.sin(k1 * t + p1) + 0.35 * Math.sin(k2 * t + p2) + rand(-0.3, 0.3));
			out.push({ x: pts[i].x - ty / tl * off, y: pts[i].y + tx / tl * off });
		}
		return out;
	}

	function resample(pts, step) {
		var out = [pts[0]], carry = 0;
		for (var i = 1; i < pts.length; i++) {
			var a = pts[i - 1], b = pts[i], seg = Math.hypot(b.x - a.x, b.y - a.y), d = step - carry;
			while (d <= seg) {
				out.push({ x: a.x + (b.x - a.x) * d / seg, y: a.y + (b.y - a.y) * d / seg });
				d += step;
			}
			carry = seg - (d - step);
		}
		var last = pts[pts.length - 1];
		if (Math.hypot(last.x - out[out.length - 1].x, last.y - out[out.length - 1].y) > step * 0.3) out.push(last);
		return out;
	}

	function qspine(p0, c, p1) {
		var out = [];
		for (var i = 0; i <= 12; i++) {
			var t = i / 12, mt = 1 - t;
			out.push({ x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x, y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y });
		}
		return out;
	}

	// One brush mark along `spine`: width w, tapering over the first `ts` and
	// last `te` of its length, with slightly jagged (dry) edges. Returns a
	// closed outline.
	function brush(spine, w, ts, te, jag) {
		var pts = resample(spine, 0.45), n = pts.length, left = [], right = [];
		var ph1 = rand(0, 6.28), ph2 = rand(0, 6.28);
		jag = jag === undefined ? 0.22 : jag;
		if (n < 2) return [];
		for (var i = 0; i < n; i++) {
			var t = i / (n - 1);
			var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
			var tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1;
			var nx = -ty / tl, ny = tx / tl;
			var half = w / 2 * (ts ? Math.pow(Math.min(1, t / ts), 0.6) : 1) * (te ? Math.pow(Math.min(1, (1 - t) / te), 0.8) : 1);
			var wl = half * (1 + jag * (0.6 * Math.sin(ph1 + t * 9) + rand(-0.5, 0.5)));
			var wr = half * (1 + jag * (0.6 * Math.sin(ph2 + t * 7) + rand(-0.5, 0.5)));
			left.push({ x: pts[i].x + nx * wl, y: pts[i].y + ny * wl });
			right.push({ x: pts[i].x - nx * wr, y: pts[i].y - ny * wr });
		}
		return left.concat(right.reverse());
	}

	// A short, slightly bent dab starting at p and heading along `ang`.
	function dab(p, ang, len, w) {
		var dx = Math.cos(ang), dy = Math.sin(ang), bend = rand(-0.25, 0.25) * len;
		var end = { x: p.x + dx * len, y: p.y + dy * len };
		var c = { x: (p.x + end.x) / 2 - dy * bend, y: (p.y + end.y) / 2 + dx * bend };
		return brush(qspine(p, c, end), w, 0.25, 0.5, 0.3);
	}

	// The wing as a curved band: midline from shoulder to wingtip, offset
	// across it by v (-1 = top edge, +1 = bottom edge).
	var WING = { s: { x: 12.5, y: -12.6 }, c: { x: -12, y: -14 }, t: { x: -44, y: -5 } };
	function wingAt(t, v) {
		var mt = 1 - t, s = WING.s, c = WING.c, e = WING.t;
		var x = mt * mt * s.x + 2 * mt * t * c.x + t * t * e.x, y = mt * mt * s.y + 2 * mt * t * c.y + t * t * e.y;
		var dx = 2 * mt * (c.x - s.x) + 2 * t * (e.x - c.x), dy = 2 * mt * (c.y - s.y) + 2 * t * (e.y - c.y);
		var l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
		var th = 5.6 * Math.pow(Math.sin(Math.PI * (0.12 + 0.88 * Math.min(1, t))), 0.9);
		return { x: x - nx * v * th, y: y - ny * v * th, ang: Math.atan2(dy, dx) };
	}

	// Pick `count` runs of consecutive outline points matching `where`, to
	// lay contour strokes along.
	function contourRuns(pts, where, count, minLen, maxLen) {
		var idx = [];
		pts.forEach(function (p, i) { if (where(p)) idx.push(i); });
		var runs = [];
		for (var k = 0; k < count && idx.length; k++) {
			var start = idx[Math.floor(Math.random() * idx.length)], len = Math.round(rand(minLen, maxLen)), run = [];
			for (var j = 0; j < len; j++) {
				var p = pts[(start + j) % pts.length];
				if (!where(p)) break;
				run.push(p);
			}
			if (run.length > 3) runs.push(run);
		}
		return runs;
	}

	// Points just inside an outline, for feather marks.
	function inward(p, centre, depth) {
		var dx = centre.x - p.x, dy = centre.y - p.y, l = Math.hypot(dx, dy) || 1;
		return { x: p.x + dx / l * depth, y: p.y + dy / l * depth };
	}
	function tangentAt(pts, i) {
		var a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
		return Math.atan2(b.y - a.y, b.x - a.x);
	}

	function join(shapes, map) {
		return shapes.filter(function (s) { return s.length; }).map(function (s) {
			return toPath(map ? s.map(map) : s);
		}).join("");
	}

	function buildVariant(scratch, v) {
		var base = MORPHS[v % MORPHS.length], m = {};
		for (var k in base) m[k] = base[k] * (k === "hump" ? 1 : rand(0.97, 1.03));
		var bmap = bodyMap(m), nmap = neckMap(m);
		var out = { neckBase: bmap(NECK) };

		// --- Body: white silhouette, feather marks, broken contour strokes.
		var body = samplePath(BODY, scratch, 0.7);
		out.body = toPath(roughen(body.map(bmap), 0.35));
		var marks = [], contour = [], centre = { x: -4, y: -8 };
		// Feather marks cluster where the black meets the white, and on the breast.
		for (var i = 0; i < 11; i++) {
			var wp = wingAt(rand(0.04, 0.45), rand(1.05, 1.75));
			marks.push(dab(wp, wp.ang + rand(-0.35, 0.35), rand(1.3, 2.8), rand(0.4, 0.75)));
		}
		for (i = 0; i < 6; i++) {
			var j = Math.floor(Math.random() * body.length), p = body[j];
			if (p.x < 8 || p.y < -12) { i--; continue; }
			marks.push(dab(inward(p, centre, rand(0.8, 2.4)), tangentAt(body, j) + rand(-0.4, 0.4), rand(1.2, 2.4), rand(0.4, 0.7)));
		}
		contourRuns(body, function (p) { return p.y > -5 || p.x > 11; }, 3, 6, 15).forEach(function (run) {
			contour.push(brush(run.map(function (p) { return inward(p, centre, 0.2); }), rand(0.55, 0.95), 0.3, 0.35));
		});
		out.marks = join(marks, bmap);
		out.contour = join(contour, bmap);

		// --- Wing: ragged base, overlapping strokes, feather tips into the white.
		var band = [];
		for (i = 0; i <= 24; i++) band.push(wingAt(i / 24, -0.8));
		for (i = 24; i >= 0; i--) band.push(wingAt(i / 24, 0.75));
		out.wingBase = toPath(roughen(resample(band.concat([band[0]]), 0.7).map(bmap), 0.35));
		var strokes = [], light = [];
		for (i = 0; i < 13; i++) {
			var vv = rand(-1.05, 1.05), t0 = rand(-0.02, 0.45), t1 = Math.min(1, t0 + rand(0.3, 0.65)), spine = [];
			for (j = 0; j <= 10; j++) spine.push(wingAt(t0 + (t1 - t0) * j / 10, vv * (1 - 0.2 * j / 10)));
			strokes.push(brush(spine, rand(2.1, 3.3) * (1 - 0.35 * t0), 0.12, 0.45));
		}
		for (i = 0; i < 3; i++) { // split wingtips
			var tv = rand(-0.4, 0.4), tspine = [];
			for (j = 0; j <= 8; j++) tspine.push(wingAt(0.55 + 0.45 * j / 8, tv));
			var last = tspine[tspine.length - 1], ext = rand(0, 3.5);
			tspine.push({ x: last.x + Math.cos(last.ang) * ext, y: last.y + Math.sin(last.ang) * ext - tv });
			strokes.push(brush(tspine, rand(1.6, 2.4), 0.1, 0.6));
		}
		for (i = 0; i < 7; i++) { // feather tips trailing below the wing
			var w = wingAt(rand(0.06, 0.7), rand(0.7, 0.95));
			strokes.push(dab(w, w.ang - rand(0.2, 0.55), rand(2, 4.2), rand(0.8, 1.4)));
		}
		for (i = 0; i < 4; i++) { // a few along the back
			w = wingAt(rand(0.05, 0.5), -0.9);
			strokes.push(dab(w, w.ang + rand(0, 0.25), rand(2, 3.5), rand(0.7, 1.1)));
		}
		for (i = 0; i < 5; i++) { // lighter strokes, so the brushwork shows inside the black
			vv = rand(-0.6, 0.6); t0 = rand(0, 0.55); t1 = Math.min(1, t0 + rand(0.15, 0.35)); spine = [];
			for (j = 0; j <= 8; j++) spine.push(wingAt(t0 + (t1 - t0) * j / 8, vv));
			light.push(brush(spine, rand(0.45, 0.9), 0.3, 0.5, 0.35));
		}
		out.wing = join(strokes, bmap);
		out.wingLight = join(light, bmap);

		// --- Neck and head.
		var neck = samplePath(NECK_HEAD, scratch, 0.6), ncentre = { x: 3, y: -12 }, hcentre = { x: 7.5, y: -26.4 };
		out.neck = toPath(roughen(neck.map(nmap), 0.28));
		var nmarks = [], nink = [];
		for (i = 0; i < 5; i++) {
			j = Math.floor(Math.random() * neck.length); p = neck[j];
			if (!(p.x > 3 && p.y > -19 && p.y < -1)) { i--; continue; } // front of the neck
			nmarks.push(dab(inward(p, ncentre, rand(0.7, 1.6)), tangentAt(neck, j) + rand(-0.3, 0.3), rand(1.2, 2.4), rand(0.4, 0.65)));
		}
		contourRuns(neck, function (p) { return p.x > 4 && p.y > -22 && p.y < 0; }, 2, 5, 12).forEach(function (run) {
			nink.push(brush(run.map(function (p) { return inward(p, ncentre, 0.15); }), rand(0.45, 0.8), 0.3, 0.35));
		});
		// Dark nape line down the back of the neck, and the crown.
		var nape = neck.filter(function (p) { return p.x < 3 && p.y > -27 && p.y < -14; });
		if (nape.length > 3) nink.push(brush(nape.map(function (p) { return inward(p, ncentre, 0.5); }), rand(0.9, 1.4), 0.2, 0.5));
		var crown = neck.filter(function (p) { return p.y < -28.5; });
		if (crown.length > 3) nink.push(brush(crown.map(function (p) { return inward(p, hcentre, 0.7); }), rand(1.3, 1.8), 0.25, 0.3));
		// Eye patch: a dark streak from the base of the bill back through the
		// eye, rising towards the back of the head, plus a small cheek spot.
		var lift = rand(-0.4, 0.4);
		nink.push(brush(qspine({ x: 11.2, y: -25.5 }, { x: 8.6, y: -26.6 + lift }, { x: 4, y: -28.4 + lift }), rand(1.9, 2.5), 0.15, 0.5, 0.3));
		nink.push(dab({ x: 8, y: -23.9 }, rand(2.3, 2.8), rand(1.2, 2), rand(0.7, 1)));
		out.neckMarks = join(nmarks, nmap);
		out.headInk = join(nink, nmap);
		var dy = HEAD_SPLIT * (m.neck - 1);
		out.eye = { x: 8.8, y: -26.4 + lift * 0.5 + dy };
		out.tip = { x: 30, y: -25.2 + dy };
		out.bill = toPath(brush([{ x: 10.8, y: -25.6 + dy }, out.tip], rand(1.2, 1.5), 0, 1, 0.08));

		// --- Legs: a dark brushed outline with a lighter, broken core showing
		// through (stilts' legs are really pinkish-red), and splayed toes that
		// show when a foot comes out of the water.
		var legSpine = function (from, len) {
			var pts = [], ph = rand(0, 6.28);
			for (var i = 0; i <= 10; i++) pts.push({ x: 0.25 * Math.sin(ph + i * 1.3), y: from + (len - from) * i / 10 });
			return pts;
		};
		var core = function (spine, a, b) {
			var segs = [], t = a;
			while (t < b - 0.08) {
				var e = Math.min(b, t + rand(0.12, 0.3));
				var i0 = Math.round(t * (spine.length - 1)), i1 = Math.round(e * (spine.length - 1));
				if (i1 - i0 >= 1) segs.push(brush(spine.slice(i0, i1 + 1), rand(0.35, 0.6), 0.3, 0.3, 0.3));
				t = e + rand(0.1, 0.25);
			}
			return segs;
		};
		var thighSpine = legSpine(-4, THIGH), shinSpine = legSpine(0, SHIN);
		out.thigh = toPath(brush(thighSpine, rand(2.3, 2.7), 0, 0.1, 0.2));
		var toes = [0.45, 0.95, 1.4].map(function (a) {
			return dab({ x: 0, y: SHIN - 0.3 }, a + rand(-0.12, 0.12), rand(3, 4.4), rand(0.6, 0.85));
		});
		toes.push(dab({ x: 0, y: SHIN - 0.3 }, 2.6 + rand(-0.15, 0.15), rand(1.4, 2), 0.6)); // hind toe
		out.shin = join([brush(shinSpine, rand(1.9, 2.2), 0, 0.04, 0.2)].concat(toes));
		out.thighCore = join(core(thighSpine, 0.25, 0.85));
		out.shinCore = join(core(shinSpine, 0.08, 0.45)); // stays above the waterline
		return out;
	}

	var variants = [];
	function buildVariants() {
		var scratch = el("g", { opacity: 0 }, svg);
		for (var v = 0; v < BIRD_VARIANTS; v++) variants.push(buildVariant(scratch, v));
		scratch.remove();
	}

	// Each shin fades out below the waterline. The fade is a gradient in the
	// shin's own coordinates, which render() moves to wherever the waterline
	// currently crosses the leg, so a raised foot comes out of the water.
	function buildLeg(parent, which, s, id) {
		var fade = el("linearGradient", { id: "wading-leg-" + id + "-" + which, gradientUnits: "userSpaceOnUse",
			x1: 0, y1: SHIN - DEPTH - 3, x2: 0, y2: SHIN }, layers.defs);
		el("stop", { offset: "0", class: "leg-stop" }, fade);
		el("stop", { offset: "0.35", class: "leg-stop", "stop-opacity": 0.45 }, fade);
		el("stop", { offset: "1", class: "leg-stop", "stop-opacity": 0 }, fade);

		var hip = el("g", { transform: "translate(" + HIPS[which] + ",0)" }, parent);
		var thigh = el("g", {}, hip);
		el("path", { class: "b-leg", d: s.thigh }, thigh);
		el("path", { class: "b-legcore", d: s.thighCore }, thigh);
		var knee = el("g", { transform: "translate(0," + THIGH + ")" }, thigh);
		var shin = el("g", {}, knee);
		el("path", { fill: "url(#wading-leg-" + id + "-" + which + ")", d: s.shin }, shin);
		el("path", { class: "b-legcore", d: s.shinCore }, shin);
		el("ellipse", { class: "b-leg", rx: 1.45, ry: 1.7 }, shin); // the joint
		return { thigh: thigh, shin: shin, fade: fade };
	}

	function buildBird(b) {
		var s = variants[b.id % BIRD_VARIANTS], t = b.id % TEX_VARIANTS;
		var bodyFill = "url(#wading-body-" + t + ")", inkFill = "url(#wading-ink-" + t + ")";
		var g = el("g", { id: "wading-bird-" + b.id });
		// Everything hangs off the hip, so crouching is a single translate.
		var hipFrame = el("g", { transform: "translate(0," + (-HIP) + ")" }, g);
		var crouch = el("g", {}, hipFrame);
		var legs = el("g", {}, crouch);
		b.legs = { back: buildLeg(legs, "back", s, b.id), front: buildLeg(legs, "front", s, b.id) };

		var upper = el("g", {}, crouch);
		// Neck/head go first so the body overlaps the base of the neck.
		var neckBase = el("g", { transform: "translate(" + s.neckBase.x.toFixed(2) + "," + s.neckBase.y.toFixed(2) + ")" }, upper);
		var head = el("g", {}, neckBase);
		el("path", { fill: bodyFill, d: s.neck }, head);
		el("path", { class: "b-mark", d: s.neckMarks }, head);
		el("path", { class: "b-ink b-soft", d: s.headInk }, head);
		el("circle", { class: "b-ink", cx: s.eye.x, cy: s.eye.y, r: 0.85 }, head);
		el("circle", { class: "b-glint", cx: s.eye.x + 0.3, cy: s.eye.y - 0.3, r: 0.28 }, head);
		el("path", { class: "b-ink", d: s.bill }, head);
		var tip = el("circle", { cx: s.tip.x, cy: s.tip.y, r: 0.1, fill: "none" }, head);

		el("path", { fill: bodyFill, d: s.body }, upper);
		el("path", { class: "b-mark", d: s.marks }, upper);
		el("path", { class: "b-ink", d: s.contour }, upper);
		el("path", { fill: inkFill, d: s.wingBase }, upper);
		el("path", { fill: inkFill, d: s.wing }, upper);
		el("path", { class: "b-ink2", d: s.wingLight }, upper);

		b.el = g; b.crouch = crouch; b.upper = upper; b.head = head; b.tip = tip; b.tipPt = s.tip;
		return g;
	}

	// ------------------------------------------------------------- Posing
	// The birds are driven by one animation loop: every frame each bird's
	// pose is advanced (springs, gait) and written into its SVG transforms.
	// Springs rather than fixed-length transitions let movements blend into
	// each other and be interrupted, and feet stay exactly where they land.

	// Two-bone IK for a leg whose hip is at the origin and foot at (fx, fy).
	// The joint bends backwards, like a stilt's (it's really the ankle).
	function solveLeg(fx, fy) {
		var d = Math.min(Math.hypot(fx, fy), THIGH + SHIN - 0.01);
		var phi = Math.atan2(fx, fy);
		var alpha = Math.acos((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d));
		var a1 = phi - alpha;
		var a2 = Math.atan2(fx - THIGH * Math.sin(a1), fy - THIGH * Math.cos(a1));
		var deg = 180 / Math.PI;
		return { thigh: -a1 * deg, shin: -(a2 - a1) * deg };
	}

	// A damped spring: k is the stiffness, z the damping ratio (a little
	// below 1 overshoots slightly, which reads as alive rather than tweened).
	function spring(x, k, z) { return { x: x, v: 0, target: x, k: k, z: z }; }
	function stepSpring(sp, dt) {
		sp.v += (sp.k * (sp.target - sp.x) - 2 * sp.z * Math.sqrt(sp.k) * sp.v) * dt;
		sp.x += sp.v * dt;
	}

	function f2(n) { return n.toFixed(2); }

	// Write a bird's current state into its SVG transforms.
	function render(b) {
		var breathe = motion ? 0.3 * Math.sin(clock * 1.8 + b.phase) : 0, drop = b.drop.x + breathe;
		var facing = b.flip.x >= 0 ? 1 : -1, deg = Math.PI / 180;
		b.el.setAttribute("transform", "translate(" + f2(b.x) + "," + f2(b.y) + ") scale(" + f2(b.s * b.flip.x) + "," + f2(b.s) + ")");
		b.crouch.setAttribute("transform", "translate(0," + f2(drop) + ")");
		b.upper.setAttribute("transform", "rotate(" + f2(b.tilt.x) + ")");
		b.head.setAttribute("transform", "rotate(" + f2(b.headRot.x) + ")");
		["front", "back"].forEach(function (w) {
			var foot = b.feet[w], leg = b.legs[w];
			var a = solveLeg((foot.x - b.x) / (b.s * facing) - HIPS[w], HIP + DEPTH - drop - foot.lift);
			leg.thigh.setAttribute("transform", "rotate(" + f2(a.thigh) + ")");
			leg.shin.setAttribute("transform", "rotate(" + f2(a.shin) + ")");
			// Where along the shin is the waterline (y = 0)?
			var kneeY = -HIP + drop + THIGH * Math.cos(a.thigh * deg), c = Math.cos((a.thigh + a.shin) * deg);
			var u = c > 0.05 ? -kneeY / c : kneeY < 0 ? 1e3 : -1e3;
			leg.fade.setAttribute("y1", f2(u - 3));
			leg.fade.setAttribute("y2", f2(u + DEPTH));
		});
	}

	// Move a foot (world x, lift in bird units) along an arc.
	function swingFoot(foot, toX, toLift, arc, dur) {
		foot.swing = { t0: clock, dur: dur, fromX: foot.x, toX: toX, fromLift: foot.lift, toLift: toLift, arc: arc };
	}

	var STEP_LEN = 15, SWING_TIME = 0.36, STEP_LIFT = 11;

	// Walking: whenever the trailing foot falls too far behind the hip, it
	// swings forward to land a little ahead of where the hip will be.
	function gait(b) {
		var bob = 0;
		["front", "back"].forEach(function (w) {
			var f = b.feet[w], sw = f.swing;
			if (!sw) return;
			var p = (clock - sw.t0) / sw.dur;
			if (p >= 1) {
				f.x = sw.toX; f.lift = sw.toLift; f.swing = null;
				if (sw.toLift === 0) ripple(f.x, b.y, false);
				return;
			}
			var e = p * p * (3 - 2 * p);
			f.x = sw.fromX + (sw.toX - sw.fromX) * e;
			f.lift = sw.fromLift + (sw.toLift - sw.fromLift) * e + sw.arc * Math.sin(Math.PI * p);
			if (sw.toLift === 0 && sw.arc) bob = Math.sin(Math.PI * p);
		});
		b.bob = bob;
		if (Math.abs(b.vx.x) < 1 || b.feet.front.swing || b.feet.back.swing || b.tucked) return;
		var dir = b.vx.x > 0 ? 1 : -1;
		var rear = (b.feet.front.x - b.feet.back.x) * dir < 0 ? "front" : "back";
		if ((b.x - b.feet[rear].x) * dir > STEP_LEN * 0.35 * b.s) {
			swingFoot(b.feet[rear], b.x + dir * STEP_LEN * 0.55 * b.s + b.vx.x * SWING_TIME, 0, STEP_LIFT, SWING_TIME);
		}
	}

	function update(b, dt) {
		while (b.queue.length && b.queue[0].t <= clock) b.queue.shift().fn();
		// Don't walk into the faded edges.
		if (b.vx.target && (b.x > W * (1 - EDGE) && b.vx.target > 0 || b.x < W * EDGE && b.vx.target < 0)) b.vx.target = 0;
		stepSpring(b.vx, dt);
		b.x += b.vx.x * dt;
		gait(b);
		// Small, quick head adjustments now and then, like real birds.
		if (b.glances && clock > b.nextGlance) {
			b.glance = Math.random() < 0.3 ? 0 : rand(-8, 8);
			b.nextGlance = clock + rand(1.2, 4);
		}
		b.headRot.target = b.headBase + (b.glances ? b.glance : 0) - 6 * b.bob;
		b.tilt.target = b.tiltBase + 1.5 * b.bob;
		b.drop.target = b.dropBase;
		stepSpring(b.tilt, dt); stepSpring(b.headRot, dt); stepSpring(b.drop, dt); stepSpring(b.flip, dt);
		if (!b.acting && clock > b.nextAct) act(b);
		render(b);
	}

	// ------------------------------------------------------------- Water marks
	// A brush-like dash: tapered at both ends, slightly bowed.
	function dashPath(x, y, len, th) {
		var b = rand(-0.6, 0.6);
		return "M" + x.toFixed(1) + "," + y.toFixed(1) +
			" Q" + (x + len / 2).toFixed(1) + "," + (y - th + b).toFixed(1) + " " + (x + len).toFixed(1) + "," + (y + rand(-0.4, 0.4)).toFixed(1) +
			" Q" + (x + len / 2).toFixed(1) + "," + (y + th + b).toFixed(1) + " " + x.toFixed(1) + "," + y.toFixed(1) + " Z";
	}

	// Dry brush: a stroke is a handful of thin bristle marks that start and
	// stop at slightly different places, some with gaps where the brush skipped.
	function brushStroke(parent, x, y, len, width) {
		var bristles = 3 + Math.floor(Math.random() * 3);
		for (var k = 0; k < bristles; k++) {
			var by = y + (k / (bristles - 1) - 0.5) * width + rand(-0.2, 0.2);
			var x0 = x + rand(0, len * 0.15), x1 = x + len * rand(0.7, 1);
			var segs = Math.random() < 0.4
				? [[x0, x0 + (x1 - x0) * rand(0.3, 0.55)], [x0 + (x1 - x0) * rand(0.6, 0.75), x1]]
				: [[x0, x1]];
			segs.forEach(function (sg) {
				el("path", { class: "streak", d: dashPath(sg[0], by, sg[1] - sg[0], rand(0.3, 0.6)),
					opacity: rand(0.45, 0.95).toFixed(2) }, parent);
			});
		}
	}

	function buildStreaks(parent) {
		var g = el("g", { class: "streaks" }, parent);
		var count = Math.round(W / 55);
		for (var i = 0; i < count; i++) {
			var cx = rand(-20, W), cy = rand(H * 0.25, H * 0.98);
			var c = el("g", {}, g);
			var d = rand(4, 12) * (Math.random() < 0.5 ? -1 : 1);
			c.style.setProperty("--d0", (-d / 2) + "px");
			c.style.setProperty("--d1", (d / 2) + "px");
			c.style.setProperty("--dur", rand(5, 11).toFixed(1) + "s");
			c.style.setProperty("--delay", (-rand(0, 10)).toFixed(1) + "s");
			var lines = 1 + Math.floor(Math.random() * 3), depth = cy / H; // nearer = slightly bigger
			for (var j = 0; j < lines; j++) {
				brushStroke(c, cx + rand(-14, 14), cy + j * rand(3.5, 5.5), rand(22, 60) * (0.6 + depth * 0.6), rand(1.6, 2.8));
			}
		}
	}

	// ------------------------------------------------------------- Ripples
	function ripple(x, y, big) {
		if (!motion) return;
		var r0 = big ? 2 : 1.5, r1 = big ? rand(20, 28) : rand(11, 16), dur = big ? 2.6 : 2.0;
		var e = el("ellipse", { class: "ripple", cx: x, cy: y, rx: r0, ry: r0 * 0.28, opacity: 0 }, layers.ripples);
		var spline = { calcMode: "spline", keySplines: "0.2 0.6 0.4 1", keyTimes: "0;1" };
		var anims = [
			Object.assign({ attributeName: "rx", from: r0, to: r1 }, spline),
			Object.assign({ attributeName: "ry", from: r0 * 0.28, to: r1 * 0.28 }, spline),
			{ attributeName: "opacity", values: "0;0.85;0", keyTimes: "0;0.12;1" }
		].map(function (a) {
			return el("animate", Object.assign({ dur: dur + "s", begin: "indefinite", fill: "freeze" }, a), e);
		});
		anims.forEach(function (a) { a.beginElement(); });
		setTimeout(function () { e.remove(); }, dur * 1000 + 50);
	}

	function tipPosition(b) {
		// Bill tip in band coordinates, via the live CTM.
		var m = b.tip.getCTM(), root = svg.getCTM();
		if (!m || !root) return null;
		var p = svg.createSVGPoint();
		p.x = b.tipPt.x; p.y = b.tipPt.y;
		return p.matrixTransform(root.inverse().multiply(m));
	}

	// ------------------------------------------------------------- Behaviour
	// Actions are short timelines on the animation clock (so they pause with it).
	function at(b, delay, fn) {
		b.queue.push({ t: clock + delay, fn: fn });
		b.queue.sort(function (p, q) { return p.t - q.t; });
	}

	function finish(b, delay) {
		at(b, delay, function () {
			b.acting = false;
			b.glances = true;
			b.nextAct = clock + rand(1.5, 7);
		});
	}

	function feed(b) {
		var dips = 1 + Math.floor(Math.random() * 3), t = 0.8;
		b.glances = false;
		b.dropBase = rand(7, 10); b.tiltBase = rand(38, 46); b.headBase = rand(60, 66);
		for (var i = 0; i < dips; i++) {
			at(b, t, function () { b.headRot.k = 520; b.headBase = rand(76, 80); });
			at(b, t + 0.16, function () {
				var p = tipPosition(b);
				if (p) ripple(p.x, b.y, true);
			});
			at(b, t + 0.24, function () { b.headRot.k = 110; b.headBase = rand(60, 66); });
			t += rand(0.6, 1.1);
		}
		at(b, t + 0.2, function () { b.dropBase = 0; b.tiltBase = b.pose.tilt; b.headBase = b.pose.head; });
		finish(b, t + 1);
	}

	// Is there a bird at a similar depth ahead of b, before it gets to x?
	// Counts where walking birds are headed, not just where they are now.
	function blocked(b, x) {
		var dir = x > b.x ? 1 : -1, dist = Math.abs(x - b.x);
		return birds.some(function (o) {
			if (o === b || Math.abs(o.y - b.y) > CLOSE_DEPTH * b.s) return false;
			var room = 60 * (b.s + o.s) / 2;
			return [o.x, o.goal == null ? o.x : o.goal].some(function (ox) {
				var ahead = (ox - b.x) * dir;
				return ahead > 0 && ahead < dist + room;
			});
		});
	}

	function walk(b) {
		var dur = rand(1.5, 4), speed = 20 * b.s;
		// Turn around rather than wander off the band or into a bird at a
		// similar depth (one clearly further back or in front can be passed:
		// the overlap then just reads as one behind the other).
		var goal = b.x + b.dir * speed * (dur + 0.4);
		if (goal > W * (1 - EDGE) || goal < W * EDGE || blocked(b, goal)) return turn(b);
		b.goal = goal;
		b.vx.target = b.dir * speed;
		at(b, dur, function () { b.vx.target = 0; });
		at(b, dur + 0.9, function () { b.goal = null; });
		finish(b, dur + 0.9);
	}

	function look(b) {
		b.glances = false;
		b.headBase = rand(-16, -10); b.tiltBase = b.pose.tilt - 4;
		at(b, rand(1.2, 2.4), function () { b.headBase = b.pose.head; b.tiltBase = b.pose.tilt; });
		finish(b, 3);
	}

	function turn(b) {
		b.dir *= -1;
		b.flip.target = b.dir;
		at(b, 0.25, function () { ripple(b.x, b.y, false); });
		finish(b, 0.7);
	}

	// Stand on one leg for a while, the other folded up, as in the painting.
	function rest(b) {
		var w = Math.random() < 0.5 ? "front" : "back", other = w === "front" ? "back" : "front";
		var down = rand(4, 9);
		b.tucked = true;
		swingFoot(b.feet[other], b.x + b.dir * rand(-1, 1) * b.s, 0, 3, 0.4); // weight over the standing foot
		at(b, 0.45, function () { swingFoot(b.feet[w], b.x + b.dir * rand(9, 13) * b.s, rand(15, 19), 0, 0.6); });
		at(b, down, function () { swingFoot(b.feet[w], b.x + b.dir * rand(-5, 5) * b.s, 0, 4, 0.5); });
		at(b, down + 0.55, function () { b.tucked = false; });
		finish(b, down + 0.7);
	}

	function idle(b) {
		var f = b.feet[Math.random() < 0.5 ? "front" : "back"];
		ripple(f.x, b.y, false);
		finish(b, rand(0.6, 1.5));
	}

	var ACTIONS = [[feed, 0.32], [walk, 0.32], [look, 0.09], [turn, 0.05], [rest, 0.08], [idle, 0.14]];

	function act(b) {
		b.acting = true;
		var r = Math.random(), fn = idle;
		for (var i = 0; i < ACTIONS.length; i++) { r -= ACTIONS[i][1]; if (r <= 0) { fn = ACTIONS[i][0]; break; } }
		fn(b);
	}

	// The loop runs only while the band is on screen and motion is allowed.
	var clock = 0, rafId = 0, lastT = 0;
	function frame(now) {
		rafId = 0;
		var dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
		lastT = now;
		clock += dt;
		birds.forEach(function (b) { update(b, dt); });
		if (motion && visible) rafId = requestAnimationFrame(frame);
	}

	function setRunning(on) {
		wrap.classList.toggle("wading-paused", !on);
		if (on && motion && birds.length && !rafId) {
			lastT = performance.now();
			rafId = requestAnimationFrame(frame);
		} else if (!on && rafId) {
			cancelAnimationFrame(rafId);
			rafId = 0;
		}
	}

	// ------------------------------------------------------------- Build
	// Birds stay out of the faded edges (see the mask in stylesheet.css).
	var EDGE = 0.17;
	// Birds closer than this in depth (px at size 1) count as side by side.
	var CLOSE_DEPTH = 26;


	function build() {
		setRunning(false);
		birds = [];
		svg.textContent = "";
		W = wrap.clientWidth;
		H = wrap.clientHeight;
		svg.setAttribute("viewBox", "0 0 " + W + " " + H);

		if (!variants.length) buildVariants();
		var defs = layers.defs = el("defs", {}, svg);
		buildPatterns(defs);
		paintTextures();

		buildStreaks(el("g", {}, svg));
		layers.reflections = el("g", { class: "reflections" }, svg);
		layers.ripples = el("g", {}, svg);
		layers.birds = el("g", {}, svg);

		// Flock: spread across the width, each bird in its own depth lane.
		// Neighbours get lanes about half the depth range apart (interleaving
		// the back and front halves: 0, 3, 1, 4, 2, 5...), so birds that
		// overlap are clearly one behind the other; further back means
		// slightly smaller.
		var baseScale = W < 600 ? 0.78 : 1;
		var span = W * (1 - 2 * EDGE);
		var n = Math.max(3, Math.round(span / (78 * baseScale)));
		var far = H * 0.56, near = H * 0.92, gap = (near - far) / (n - 1);
		var half = Math.ceil(n / 2), flipLanes = Math.random() < 0.5;
		for (var i = 0; i < n; i++) {
			var lane = i % 2 ? half + (i - 1) / 2 : i / 2;
			if (flipLanes) lane = n - 1 - lane;
			var depth = lane / (n - 1);
			var x = W * EDGE + (i + 0.5 + rand(-0.3, 0.3)) * (span / n), s = baseScale * (0.8 + 0.2 * depth) * rand(0.97, 1.03);
			var dir = Math.random() < 0.6 ? 1 : -1, pose = { tilt: rand(-4, 6), head: rand(-6, 8) };
			// Feet in band coordinates; some birds start mid-stride.
			var midStride = Math.random() < 0.25;
			var b = {
				id: uid++, x: x, y: far + lane * gap + rand(-0.2, 0.2) * gap, s: s, dir: dir, pose: pose,
				feet: {
					front: { x: x + dir * s * (midStride ? rand(8, 12) : rand(0, 6)), lift: 0, swing: null },
					back: { x: x + dir * s * (midStride ? rand(-14, -9) : rand(-8, -2)), lift: 0, swing: null }
				},
				vx: spring(0, 8, 1), flip: spring(dir, 90, 1),
				tilt: spring(pose.tilt, 60, 0.9), headRot: spring(pose.head, 110, 0.75), drop: spring(0, 50, 1),
				tiltBase: pose.tilt, headBase: pose.head, dropBase: 0,
				glances: true, glance: 0, nextGlance: rand(0, 3), bob: 0, phase: rand(0, 6.28),
				queue: [], acting: false, nextAct: clock + rand(0.3, 6), goal: null, tucked: false
			};
			birds.push(b);
		}
		birds.sort(function (a, b) { return a.y - b.y; });
		birds.forEach(function (b) {
			layers.birds.appendChild(buildBird(b));
			render(b);
			// Reflection: the live bird, mirrored about its own waterline and squashed.
			el("use", { href: "#wading-bird-" + b.id,
				transform: "matrix(1,0,0,-0.55,0," + (b.y * 1.55).toFixed(1) + ")" }, layers.reflections);
		});

		renderWater();
		setRunning(visible);
	}

	// ------------------------------------------------------------- Wiring
	var lastW = 0, resizeTimer;
	window.addEventListener("resize", function () {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(function () {
			var w = wrap.clientWidth;
			if (Math.abs(w - lastW) > 40) { lastW = w; build(); }
		}, 250);
	});

	// Theme switches recolour the baked water and bird textures.
	new MutationObserver(function () {
		if (!W) return;
		paintTextures();
		renderWater();
	}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

	if ("IntersectionObserver" in window) {
		new IntersectionObserver(function (entries) {
			visible = entries[0].isIntersecting && !document.hidden;
			setRunning(visible);
		}).observe(wrap);
	}
	document.addEventListener("visibilitychange", function () {
		visible = !document.hidden;
		setRunning(visible);
	});
	var onMotionPref = function () {
		motion = !reducedMotion.matches;
		setRunning(false);
		if (!motion) birds.forEach(function (b) { b.queue = []; render(b); });
		setRunning(visible);
	};
	if (reducedMotion.addEventListener) reducedMotion.addEventListener("change", onMotionPref);

	// A background tab can report zero width; build once there's room.
	(function init() {
		lastW = wrap.clientWidth;
		if (lastW && wrap.clientHeight) build();
		else requestAnimationFrame(init);
	})();
})();

import * as THREE from "three";
import type { Scene3DSettings } from "@/components/video-editor/scene3d";

export interface ThreeSceneRenderResult {
	canvas: HTMLCanvasElement;
	fallbackUsed: boolean;
	warnings: string[];
}

export function isWebGLAvailable() {
	if (typeof document === "undefined") return false;
	const canvas = document.createElement("canvas");
	return Boolean(
		canvas.getContext("webgl2") ||
			canvas.getContext("webgl") ||
			canvas.getContext("experimental-webgl"),
	);
}

function createDeviceMesh(settings: Scene3DSettings, texture: THREE.Texture) {
	const group = new THREE.Group();
	const screen = new THREE.Mesh(
		new THREE.BoxGeometry(3.2, 1.95, 0.06),
		new THREE.MeshStandardMaterial({
			map: texture,
			roughness: 0.42,
			metalness: 0.08,
		}),
	);
	screen.position.y = 0.34;
	screen.rotation.x = settings.presetId === "apple-keynote-macbook" ? -0.08 : 0;
	group.add(screen);

	if (settings.deviceModel === "macbook-pro") {
		const base = new THREE.Mesh(
			new THREE.BoxGeometry(3.7, 0.08, 2.15),
			new THREE.MeshStandardMaterial({
				color: 0xb8bdc4,
				roughness: 0.32,
				metalness: 0.72,
			}),
		);
		base.position.set(0, -0.73, 0.75);
		base.rotation.x = 0.34;
		group.add(base);
	}

	return group;
}

export async function renderThreeSceneFrame(options: {
	sourceCanvas: HTMLCanvasElement;
	settings: Scene3DSettings;
	width: number;
	height: number;
}): Promise<ThreeSceneRenderResult> {
	const warnings: string[] = [];
	if (!options.settings.enabled || !isWebGLAvailable()) {
		warnings.push("3D scene rendering fell back to the 2D composition path.");
		return {
			canvas: options.sourceCanvas,
			fallbackUsed: true,
			warnings,
		};
	}

	const outputCanvas = document.createElement("canvas");
	outputCanvas.width = Math.max(1, Math.round(options.width));
	outputCanvas.height = Math.max(1, Math.round(options.height));

	const renderer = new THREE.WebGLRenderer({
		canvas: outputCanvas,
		alpha: options.settings.environment === "transparent",
		antialias: true,
		preserveDrawingBuffer: true,
	});
	renderer.setSize(outputCanvas.width, outputCanvas.height, false);
	renderer.setPixelRatio(1);
	renderer.shadowMap.enabled = true;

	const scene = new THREE.Scene();
	scene.background =
		options.settings.environment === "transparent"
			? null
			: new THREE.Color(options.settings.environment === "dark-stage" ? 0x08090c : 0xf4f6f8);

	const texture = new THREE.CanvasTexture(options.sourceCanvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	const device = createDeviceMesh(options.settings, texture);
	scene.add(device);

	const key = new THREE.DirectionalLight(0xffffff, options.settings.lighting.keyIntensity);
	key.position.set(-2.5, 3, 4);
	key.castShadow = true;
	scene.add(key);
	scene.add(new THREE.AmbientLight(0xffffff, options.settings.lighting.fillIntensity));

	const cameraKeyframe = options.settings.cameraKeyframes[0];
	const camera = new THREE.PerspectiveCamera(
		cameraKeyframe?.fov ?? 38,
		outputCanvas.width / outputCanvas.height,
		0.1,
		100,
	);
	camera.position.set(
		cameraKeyframe?.position.x ?? 0,
		cameraKeyframe?.position.y ?? 0.24,
		cameraKeyframe?.position.z ?? 4.2,
	);
	camera.lookAt(
		cameraKeyframe?.target.x ?? 0,
		cameraKeyframe?.target.y ?? 0,
		cameraKeyframe?.target.z ?? 0,
	);

	renderer.render(scene, camera);
	texture.dispose();
	renderer.dispose();
	return { canvas: outputCanvas, fallbackUsed: false, warnings };
}

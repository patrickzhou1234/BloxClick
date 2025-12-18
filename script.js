const canvas = document.getElementById("babcanv");
const menuselections = document.getElementById("menuselections");
const frontfacingvis = document.getElementById("frontfacingvis");
let checked = true;
const meshtype = document.getElementById("meshtype");
const slimyToggle = document.getElementById("slimyToggle");
const menureveal = document.getElementById("menureveal");
const size = document.getElementById("sizeToggle");
const clearBtn = document.getElementById("clearBtn");
const loadingScreen = document.getElementById("loadingScreen");
const engine = new BABYLON.Engine(canvas, true);

// External player model (GLB). Kept as provided link.
const PLAYER_MODEL_URL = "https://files.catbox.moe/lq8w3k.glb";
let playerModelContainer = null;
let modelLoaded = false;

const socket = io();
const otherPlayers = {};
const spawnedBlocks = [];

// Register as a player when connected
socket.on('connect', () => {
    socket.emit('registerPlayer');
});

// Third person toggle state
let isThirdPerson = false;

// Active key state tracking
const keysPressed = {};

async function preloadPlayerModel(scene) {
    try {
        playerModelContainer = await BABYLON.SceneLoader.LoadAssetContainerAsync("", PLAYER_MODEL_URL, scene);
        playerModelContainer.meshes.forEach((mesh) => {
            mesh.isPickable = false;
            mesh.checkCollisions = false;
        });
        modelLoaded = true;
    } catch (err) {
        console.error("Unable to load player model:", err);
        playerModelContainer = null;
        modelLoaded = true; // Still mark as loaded so we can use fallback
    }
}

function createPrimitiveFallbackCharacter(scene, parent, name, color) {
    const characterRoot = parent || new BABYLON.TransformNode(name, scene);
    
    const mat = new BABYLON.StandardMaterial(name + "Mat", scene);
    mat.diffuseColor = color;
    mat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    
    const body = BABYLON.MeshBuilder.CreateCylinder(name + "Body", {
        height: 0.8, 
        diameterTop: 0.5, 
        diameterBottom: 0.6
    }, scene);
    body.position.y = 0.4;
    body.material = mat;
    body.parent = characterRoot;
    
    const head = BABYLON.MeshBuilder.CreateSphere(name + "Head", {
        diameter: 0.5, 
        segments: 16
    }, scene);
    head.position.y = 1.05;
    head.material = mat;
    head.parent = characterRoot;
    
    const eyeMat = new BABYLON.StandardMaterial(name + "EyeMat", scene);
    eyeMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    eyeMat.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    
    const leftEye = BABYLON.MeshBuilder.CreateSphere(name + "LeftEye", {diameter: 0.1}, scene);
    leftEye.position.set(-0.1, 1.1, 0.2);
    leftEye.material = eyeMat;
    leftEye.parent = characterRoot;
    
    const rightEye = BABYLON.MeshBuilder.CreateSphere(name + "RightEye", {diameter: 0.1}, scene);
    rightEye.position.set(0.1, 1.1, 0.2);
    rightEye.material = eyeMat;
    rightEye.parent = characterRoot;
    
    const pupilMat = new BABYLON.StandardMaterial(name + "PupilMat", scene);
    pupilMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    
    const leftPupil = BABYLON.MeshBuilder.CreateSphere(name + "LeftPupil", {diameter: 0.05}, scene);
    leftPupil.position.set(-0.1, 1.1, 0.24);
    leftPupil.material = pupilMat;
    leftPupil.parent = characterRoot;
    
    const rightPupil = BABYLON.MeshBuilder.CreateSphere(name + "RightPupil", {diameter: 0.05}, scene);
    rightPupil.position.set(0.1, 1.1, 0.24);
    rightPupil.material = pupilMat;
    rightPupil.parent = characterRoot;
    
    const leftArm = BABYLON.MeshBuilder.CreateCapsule(name + "LeftArm", {
        height: 0.6, 
        radius: 0.1
    }, scene);
    leftArm.position.set(-0.4, 0.5, 0);
    leftArm.rotation.z = Math.PI / 6;
    leftArm.material = mat;
    leftArm.parent = characterRoot;
    
    const rightArm = BABYLON.MeshBuilder.CreateCapsule(name + "RightArm", {
        height: 0.6, 
        radius: 0.1
    }, scene);
    rightArm.position.set(0.4, 0.5, 0);
    rightArm.rotation.z = -Math.PI / 6;
    rightArm.material = mat;
    rightArm.parent = characterRoot;
    
    const leftLeg = BABYLON.MeshBuilder.CreateCapsule(name + "LeftLeg", {
        height: 0.6, 
        radius: 0.12
    }, scene);
    leftLeg.position.set(-0.15, -0.3, 0);
    leftLeg.material = mat;
    leftLeg.parent = characterRoot;
    
    const rightLeg = BABYLON.MeshBuilder.CreateCapsule(name + "RightLeg", {
        height: 0.6, 
        radius: 0.12
    }, scene);
    rightLeg.position.set(0.15, -0.3, 0);
    rightLeg.material = mat;
    rightLeg.parent = characterRoot;
    
    return characterRoot;
}

// Create the character mesh using the external GLB with a primitive fallback
function createCharacterMesh(scene, name, color) {
    const characterRoot = new BABYLON.TransformNode(name, scene);
    characterRoot.scaling = new BABYLON.Vector3(5, 5, 5); // scale model up by 5x
    
    if (!playerModelContainer) {
        createPrimitiveFallbackCharacter(scene, characterRoot, name, color);
        return characterRoot;
    }
    
    try {
        const instanced = playerModelContainer.instantiateModelsToScene(
            (nodeName) => `${name}_${nodeName}`,
            false
        );
        instanced.rootNodes.forEach((node) => {
            node.parent = characterRoot;
            node.setEnabled(true);
        });
        instanced.animationGroups.forEach((anim) => anim.stop());
    } catch (err) {
        console.error("Error instantiating player model:", err);
        createPrimitiveFallbackCharacter(scene, characterRoot, name, color);
    }
    
    return characterRoot;
}

var createSceneWithoutPlayer = function () {
    var scene = new BABYLON.Scene(engine);
    scene.collisionsEnabled = true;
    scene.enablePhysics(new BABYLON.Vector3(0,-9.81, 0), new BABYLON.AmmoJSPlugin);
    scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.15, 1);
    
    // Camera setup
    camera = new BABYLON.FreeCamera("Camera", new BABYLON.Vector3(0, 1, 0), scene);
    camera.attachControl(canvas, true);
    camera.keysUp.pop(38);
    camera.keysDown.pop(40);
    camera.keysLeft.pop(37);
    camera.keysRight.pop(39);
    camera.angularSensibility = 10000;

    // Lights
    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    
    var dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -2, -1), scene);
    dirLight.intensity = 0.5;

    var wallmat = new BABYLON.StandardMaterial("wallmat", scene);
    wallmat.diffuseTexture = new BABYLON.Texture("wood.jpg", scene);
    wallmat.backFaceCulling = false;

    var groundmat = new BABYLON.StandardMaterial("groundmat", scene);
    groundmat.diffuseTexture = new BABYLON.Texture("https://i.imgur.com/fr2946D.png", scene);
    var ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 30, height: 30}, scene);
    ground.material = groundmat;
    ground.physicsImpostor = new BABYLON.PhysicsImpostor(ground, BABYLON.PhysicsImpostor.MeshImpostor, {mass:0, restitution:0.3}, scene);
    
    var wallz = [15, 0, 0, -15];
    var wallrot = [0, 1, 1, 0];
    var wallx = [null, -15, 15, null];
    for (let i=0; i<4; i++) {
        var wall = BABYLON.MeshBuilder.CreateBox("wall", {width:30, height:2, depth:0.5}, scene);
        wall.physicsImpostor = new BABYLON.PhysicsImpostor(wall, BABYLON.PhysicsImpostor.BoxImpostor, {mass:0, restitution: 0.9}, scene);
        wall.position.y = 1;
        wall.position.z = wallz[i];
        wall.material = wallmat;
        if (wallrot[i] == 1) {
            wall.rotate(new BABYLON.Vector3(0, 1, 0), Math.PI/2, BABYLON.Space.LOCAL);
        }
        if (!(wallx[i] == null)) {
            wall.position.x = wallx[i];
        }
    }

    // Skybox gradient
    var bluemat = new BABYLON.StandardMaterial("bluemat", scene);
    bluemat.diffuseColor = new BABYLON.Color3.FromHexString("#87CEEB");
    bluemat.backFaceCulling = false;
    bluemat.emissiveColor = new BABYLON.Color3(0.3, 0.4, 0.5);
    var skybox = BABYLON.MeshBuilder.CreateSphere("skybox", {segments:32, diameter:100}, scene);
    skybox.material = bluemat;

    frontfacing = BABYLON.Mesh.CreateBox("front", 1, scene);
    frontfacing.visibility = 0.5;
    var frontMat = new BABYLON.StandardMaterial("frontMat", scene);
    frontMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    frontMat.alpha = 0.3;
    frontfacing.material = frontMat;

    // Jump reload
    jumpreloading = false;

    return scene;
};

function createPlayer(scene) {
    // Player physics body (invisible sphere for physics)
    playerPhysicsBody = BABYLON.MeshBuilder.CreateSphere("playerPhysics", {diameter:1.5, segments:8}, scene);
    playerPhysicsBody.position.y = 3;
    playerPhysicsBody.visibility = 0;
    playerPhysicsBody.physicsImpostor = new BABYLON.PhysicsImpostor(playerPhysicsBody, BABYLON.PhysicsImpostor.SphereImpostor, {mass:1, restitution:0.3, friction: 0.5}, scene);
    
    // Player visual mesh (humanoid)
    player = createCharacterMesh(scene, "player", new BABYLON.Color3(0.2, 0.6, 1));
    player.position.y = 3;

    scene.registerBeforeRender(function() {
        // Sync player visual to physics body
        player.position.copyFrom(playerPhysicsBody.position);
        player.position.y -= 0.75; // Offset for character feet (physics sphere center to ground)
        
        if (!isThirdPerson) {
            camera.position.set(playerPhysicsBody.position.x, playerPhysicsBody.position.y + 0.5, playerPhysicsBody.position.z);
        } else {
            var forward = camera.getDirection(new BABYLON.Vector3(0, 0, 1));
            camera.position = playerPhysicsBody.position.subtract(forward.scale(8)).add(new BABYLON.Vector3(0, 3, 0));
        }

        // Update frontfacing position
        var forward = camera.getDirection(new BABYLON.Vector3(0, 0, 1));
        frontfacing.position = playerPhysicsBody.position.add(forward.scale(5));
        
        // Continuous movement based on active keys
        handleMovement();
        
        // Emit player movement
        if (playerPhysicsBody && playerPhysicsBody.physicsImpostor) {
            const pos = playerPhysicsBody.getAbsolutePosition();
            socket.emit('playerMovement', {
                x: pos.x,
                y: pos.y,
                z: pos.z,
                rotation: camera.rotation.y
            });
        }
    });
}

function handleMovement() {
    if (!playerPhysicsBody || !playerPhysicsBody.physicsImpostor) return;
    
    var forward = camera.getDirection(new BABYLON.Vector3(0, 0, 1));
    var right = camera.getDirection(new BABYLON.Vector3(1, 0, 0));
    forward.y = 0;
    forward.normalize();
    right.y = 0;
    right.normalize();
    
    const impulseStrength = 0.08;
    
    if (keysPressed['KeyW'] || keysPressed['ArrowUp']) {
        playerPhysicsBody.physicsImpostor.applyImpulse(forward.scale(impulseStrength), playerPhysicsBody.getAbsolutePosition());
    }
    if (keysPressed['KeyS'] || keysPressed['ArrowDown']) {
        playerPhysicsBody.physicsImpostor.applyImpulse(forward.scale(-impulseStrength), playerPhysicsBody.getAbsolutePosition());
    }
    if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) {
        playerPhysicsBody.physicsImpostor.applyImpulse(right.scale(-impulseStrength), playerPhysicsBody.getAbsolutePosition());
    }
    if (keysPressed['KeyD'] || keysPressed['ArrowRight']) {
        playerPhysicsBody.physicsImpostor.applyImpulse(right.scale(impulseStrength), playerPhysicsBody.getAbsolutePosition());
    }
    
    // Brake/crouch
    if (keysPressed['ShiftLeft'] || keysPressed['ShiftRight']) {
        var ray = new BABYLON.Ray(playerPhysicsBody.position, new BABYLON.Vector3(0, -1, 0), 1.1);
        var hit = scene.pickWithRay(ray, function (mesh) {
            return mesh != playerPhysicsBody && mesh.name !== "player";
        });

        if (hit && hit.hit) {
            playerPhysicsBody.physicsImpostor.setLinearVelocity(playerPhysicsBody.physicsImpostor.getLinearVelocity().scale(0.9));
            playerPhysicsBody.physicsImpostor.setAngularVelocity(playerPhysicsBody.physicsImpostor.getAngularVelocity().scale(0.9));
        }
    }
}

let scene;

// Initialize the game after loading assets
async function initGame() {
    // Create the scene first (without the player)
    scene = createSceneWithoutPlayer();
    
    // Preload the player model into the actual scene
    await preloadPlayerModel(scene);
    
    // Now create the player
    createPlayer(scene);
    
    // Hide loading screen
    loadingScreen.classList.add('hidden');
    
    // Start render loop
    engine.runRenderLoop(function () {
        scene.render();
    });
}

// Start the game
initGame();

// Multiplayer Logic
function addOtherPlayer(playerInfo) {
    const mesh = createCharacterMesh(scene, "otherPlayer_" + playerInfo.playerId, new BABYLON.Color3(1, 0.3, 0.3));
    mesh.position.set(playerInfo.x, playerInfo.y - 0.75, playerInfo.z);
    
    // Invisible physics collider
    const collider = BABYLON.MeshBuilder.CreateSphere("otherCollider_" + playerInfo.playerId, {diameter:1.5, segments:8}, scene);
    collider.position.set(playerInfo.x, playerInfo.y, playerInfo.z);
    collider.visibility = 0;
    collider.physicsImpostor = new BABYLON.PhysicsImpostor(collider, BABYLON.PhysicsImpostor.SphereImpostor, {mass:0, restitution:0.3}, scene);
    
    otherPlayers[playerInfo.playerId] = { mesh, collider };
}

socket.on('currentPlayers', (players) => {
    Object.keys(players).forEach((id) => {
        if (id === socket.id) return;
        addOtherPlayer(players[id]);
    });
});

socket.on('currentBlocks', (blocks) => {
    blocks.forEach((block) => {
        spawnBlock(block);
    });
});

socket.on('newPlayer', (playerInfo) => {
    addOtherPlayer(playerInfo);
});

socket.on('playerMoved', (playerInfo) => {
    if (otherPlayers[playerInfo.playerId]) {
        otherPlayers[playerInfo.playerId].mesh.position.set(playerInfo.x, playerInfo.y - 0.75, playerInfo.z);
        otherPlayers[playerInfo.playerId].collider.position.set(playerInfo.x, playerInfo.y, playerInfo.z);
        if (otherPlayers[playerInfo.playerId].collider.physicsImpostor) {
            otherPlayers[playerInfo.playerId].collider.physicsImpostor.setTransformationFromPhysicsBody();
        }
    }
});

socket.on('disconnectPlayer', (playerId) => {
    if (otherPlayers[playerId]) {
        otherPlayers[playerId].mesh.dispose();
        otherPlayers[playerId].collider.dispose();
        delete otherPlayers[playerId];
    }
});

socket.on('blockSpawned', (blockData) => {
    spawnBlock(blockData);
});

socket.on('clearBlocks', () => {
    spawnedBlocks.forEach(mesh => {
        mesh.dispose();
    });
    spawnedBlocks.length = 0;
});

// Helper function to spawn block
function spawnBlock(data) {
    var meshmat = new BABYLON.StandardMaterial("meshmat", scene);
    meshmat.diffuseColor = new BABYLON.Color3.FromHexString(data.color);
    meshmat.backFaceCulling = false;

    var mesh;
    var frictionVal = data.slimy ? 300 : 0.5;
    
    if (data.type == "box") {
        mesh = BABYLON.MeshBuilder.CreateBox("mesh", {size:data.size}, scene);
        mesh.physicsImpostor = new BABYLON.PhysicsImpostor(mesh, BABYLON.PhysicsImpostor.BoxImpostor, {mass:1, restitution:0, friction: frictionVal}, scene);
    }
    else if (data.type == "sphere") {
        mesh = BABYLON.MeshBuilder.CreateSphere("mesh", {diameter:data.size, segments:32}, scene);
        mesh.physicsImpostor = new BABYLON.PhysicsImpostor(mesh, BABYLON.PhysicsImpostor.SphereImpostor, {mass:1, restitution:0, friction: frictionVal}, scene);
    }
    else if (data.type == "cylinder") {
        mesh = BABYLON.MeshBuilder.CreateCylinder("mesh", {height:data.size, diameter:data.size}, scene);
        mesh.physicsImpostor = new BABYLON.PhysicsImpostor(mesh, BABYLON.PhysicsImpostor.CylinderImpostor, {mass:1, restitution:0, friction: frictionVal}, scene);
    }
    else if (data.type == "capsule") {
        mesh = BABYLON.MeshBuilder.CreateCapsule("mesh", {height:data.size, radius:(data.size/3)}, scene);
        mesh.physicsImpostor = new BABYLON.PhysicsImpostor(mesh, BABYLON.PhysicsImpostor.CapsuleImpostor, {mass:1, restitution:0, friction: frictionVal}, scene);
    }
    
    mesh.material = meshmat;
    if (data.type == "box" || data.type == "cylinder") {
        mesh.enableEdgesRendering();
        mesh.edgesWidth = 4.0;
        mesh.edgesColor = new BABYLON.Color4(1, 1, 1, 1);
    }
    mesh.position.set(data.position.x, data.position.y, data.position.z);
    
    spawnedBlocks.push(mesh);
}

frontfacingvis.onchange = function() {
    if (checked) {
        frontfacing.visibility = 0;
        checked = false;
    } else {
        frontfacing.visibility = 0.5;
        checked = true;
    }
}

canvas.onclick = function() {
    canvas.requestPointerLock = 
        canvas.requestPointerLock ||
        canvas.mozRequestPointerLock ||
        canvas.webkitRequestPointerLock;
    canvas.requestPointerLock();

    const sizeval = size.value/50;
    
    const spawnPos = frontfacing.getAbsolutePosition();
    const blockData = {
        type: meshtype.value,
        size: sizeval,
        position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
        color: document.getElementById("colorpicker").value,
        slimy: slimyToggle.checked
    };

    spawnBlock(blockData);
    socket.emit('spawnBlock', blockData);
}

clearBtn.onclick = function() {
    socket.emit('clearBlocks');
}

// Key state tracking
document.addEventListener('keydown', function(event) {
    keysPressed[event.code] = true;
    
    // Toggle Camera 'C'
    if (event.code === "KeyC") {
        isThirdPerson = !isThirdPerson;
    }

    // Jump
    if (event.code === "Space") {
        if (!jumpreloading) {
            jumpreloading = true;
            playerPhysicsBody.physicsImpostor.applyImpulse(new BABYLON.Vector3(0, 1, 0).scale(10), playerPhysicsBody.getAbsolutePosition());
            setTimeout(function() {
                jumpreloading = false;
            }, 3000);
        }
    }
});

document.addEventListener('keyup', function(event) {
    keysPressed[event.code] = false;
});

menureveal.onclick = function() {
    if (menureveal.innerHTML == "⇧") {
        menureveal.innerHTML = "⇩";
        menureveal.style.top = "0px";
        menuselections.style.top = "-80px";
    } else {
        menureveal.innerHTML = "⇧";
        menureveal.style.top = "70px";
        menuselections.style.top = "0px";
    }
}

window.addEventListener("resize", function () {
    engine.resize();
});

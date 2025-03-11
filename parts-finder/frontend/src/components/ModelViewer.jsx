// ModelViewer component v3 - Improved Three.js integration
// Create a global object to track instances across all components
if (!window.modelViewerGlobals) {
  window.modelViewerGlobals = {
    activeInstance: null,
    instanceCount: 0,
    isInitialized: false
  };
}

window.ModelViewer = function ModelViewer({ filePath }) {
  // Use the global instance tracking
  const instanceId = React.useRef(null);
  
  // Initialize instance ID if not already set
  if (instanceId.current === null) {
    window.modelViewerGlobals.instanceCount++;
    instanceId.current = window.modelViewerGlobals.instanceCount;
    console.log(`ModelViewer: Creating instance ${instanceId.current} for ${filePath}`);
    
    // Make this the active instance
    window.modelViewerGlobals.activeInstance = instanceId.current;
    window.modelViewerGlobals.isInitialized = false; // Reset initialization flag
  }
  
  const containerRef = React.useRef(null);
  const isInitializedRef = React.useRef(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [modelLoaded, setModelLoaded] = React.useState(false);
  const [isMeasuring, setIsMeasuring] = React.useState(false);
  const [measurePoints, setMeasurePoints] = React.useState([]);
  const [measureDistance, setMeasureDistance] = React.useState(null);
  const [transformMode, setTransformMode] = React.useState(null); // 'translate', 'rotate', 'scale'
  const [transformAxis, setTransformAxis] = React.useState(null); // 'x', 'y', 'z', null (all axes)
  const [showHelp, setShowHelp] = React.useState(false);
  
  // Store Three.js objects in refs to avoid React DOM issues
  const threeObjects = React.useRef({
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    mesh: null,
    animationId: null,
    gridHelper: null,
    axesHelper: null,
    measurementLine: null,
    raycaster: null,
    mouse: null,
    transformControls: null
  });
  
  // Create a global cleanup function that can be called from outside the component
  window.threeJsCleanup = function() {
    console.log(`Instance ${instanceId.current}: Global Three.js cleanup called`);
    
    // Reset initialization flag
    if (isInitializedRef.current) {
      isInitializedRef.current = false;
    }
    
    // Reset global initialization state if this is the active instance
    if (window.modelViewerGlobals.activeInstance === instanceId.current) {
      window.modelViewerGlobals.isInitialized = false;
      window.modelViewerGlobals.activeInstance = null;
    }
    
    // Remove event listeners
    document.removeEventListener('keydown', window.modelViewerKeydownHandler);
    
    // Cancel animation frame
    if (threeObjects.current.animationId) {
      cancelAnimationFrame(threeObjects.current.animationId);
      threeObjects.current.animationId = null;
      window.modelViewerAnimationId = null;
    }
    
    // Clean up the scene and resources
    const { scene, controls, mesh, measurementLine, renderer, transformControls } = threeObjects.current;
    
    // Dispose mesh
    if (mesh) {
      if (scene) scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(material => material.dispose());
        } else {
          mesh.material.dispose();
        }
      }
      threeObjects.current.mesh = null;
    }
    
    // Dispose transform controls
    if (transformControls) {
      if (scene) scene.remove(transformControls);
      threeObjects.current.transformControls = null;
    }
    
    // Dispose measurement line
    if (measurementLine) {
      if (scene) scene.remove(measurementLine);
      if (measurementLine.geometry) measurementLine.geometry.dispose();
      if (measurementLine.material) measurementLine.material.dispose();
      threeObjects.current.measurementLine = null;
    }
    
    // Dispose controls
    if (controls) {
      controls.dispose();
      threeObjects.current.controls = null;
    }
    
    // Dispose renderer
    if (renderer) {
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        try {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        } catch (e) {
          console.error(`Instance ${instanceId.current}: Error removing renderer DOM element:`, e);
        }
      }
      threeObjects.current.renderer = null;
    }
    
    // Clear scene
    if (scene) {
      while(scene.children.length > 0) { 
        const object = scene.children[0];
        scene.remove(object);
      }
      threeObjects.current.scene = null;
    }
    
    // Reset all refs
    threeObjects.current = {
      scene: null,
      camera: null,
      renderer: null,
      controls: null,
      mesh: null,
      animationId: null,
      gridHelper: null,
      axesHelper: null,
      measurementLine: null,
      raycaster: null,
      mouse: null,
      transformControls: null
    };
    
    // Decrement instance count
    window.modelViewerGlobals.instanceCount--;
    console.log(`Instance ${instanceId.current}: Cleanup complete, remaining instances: ${window.modelViewerGlobals.instanceCount}`);
  };
  
  // Initialize Three.js scene
  const initThreeJs = React.useCallback(() => {
    if (!containerRef.current) return false;
    
    // If already initialized, don't initialize again
    if (isInitializedRef.current) {
      console.log(`Instance ${instanceId.current}: Already initialized, skipping initialization`);
      return true; // Return true to indicate success
    }
    
    // Always allow the active instance to initialize
    if (window.modelViewerGlobals.activeInstance === instanceId.current) {
      window.modelViewerGlobals.isInitialized = false; // Reset to allow initialization
    }
    
    try {
      // Check if there's already a canvas in the container
      const existingCanvas = containerRef.current.querySelector('canvas');
      if (existingCanvas) {
        console.log(`Instance ${instanceId.current}: Container already has a canvas, skipping initialization`);
        isInitializedRef.current = true;
        window.modelViewerGlobals.isInitialized = true;
        window.modelViewerGlobals.activeInstance = instanceId.current;
        return true;
      }
      
      console.log(`Instance ${instanceId.current}: Initializing Three.js scene`);
      
      // Mark this instance as the active one
      window.modelViewerGlobals.isInitialized = true;
      window.modelViewerGlobals.activeInstance = instanceId.current;
      
      // Setup scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x121212);
      
      // Setup camera
      const camera = new THREE.PerspectiveCamera(
        75,
        containerRef.current.clientWidth / containerRef.current.clientHeight,
        0.1,
        1000
      );
      camera.position.z = 100;
      
      // Setup renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      );
      
      // Clear container before adding new elements
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(renderer.domElement);
      
      // Add lights
      const ambientLight = new THREE.AmbientLight(0x404040);
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
      directionalLight.position.set(0, 1, 0);
      scene.add(directionalLight);
      
      // Add a second directional light from another angle
      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
      directionalLight2.position.set(1, -1, 1);
      scene.add(directionalLight2);
      
      // Add grid helper (100x100 grid with 10 unit divisions) - Larger grid that doesn't move with the model
      const gridHelper = new THREE.GridHelper(100, 20, 0x888888, 0x444444);
      gridHelper.position.y = -0.01; // Slight offset to prevent z-fighting
      scene.add(gridHelper);
      
      // Add axes helper (RGB = XYZ)
      const axesHelper = new THREE.AxesHelper(50);
      
      // Customize axes colors to match the help panel
      if (axesHelper.material instanceof THREE.Material) {
        // For older Three.js versions
        axesHelper.material.vertexColors = true;
      } else if (Array.isArray(axesHelper.material)) {
        // For newer Three.js versions that use an array of materials
        axesHelper.material.forEach(mat => {
          mat.vertexColors = true;
        });
      }
      
      // Update the vertices colors in the geometry
      if (axesHelper.geometry.attributes.color) {
        const colors = axesHelper.geometry.attributes.color.array;
        
        // X axis remains red (first 2 vertices)
        // colors[0] through colors[5] stay the same (red)
        
        // Y axis: change from green to blue (vertices 6-11)
        colors[6] = 0;  // R
        colors[7] = 0;  // G
        colors[8] = 1;  // B
        colors[9] = 0;  // R
        colors[10] = 0; // G
        colors[11] = 1; // B
        
        // Z axis: change from blue to green (vertices 12-17)
        colors[12] = 0; // R
        colors[13] = 1; // G
        colors[14] = 0; // B
        colors[15] = 0; // R
        colors[16] = 1; // G
        colors[17] = 0; // B
        
        axesHelper.geometry.attributes.color.needsUpdate = true;
      }
      
      scene.add(axesHelper);
      
      // Setup for measurements
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      
      // Add orbit controls
      const controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      
      // Add transform controls
      let transformControls = null;
      try {
        if (typeof THREE.TransformControls === 'function') {
          console.log('THREE.TransformControls is available');
          transformControls = new THREE.TransformControls(camera, renderer.domElement);
          transformControls.addEventListener('dragging-changed', function(event) {
            // Disable orbit controls when using transform controls
            controls.enabled = !event.value;
          });
          scene.add(transformControls);
          transformControls.visible = false; // Hide initially until a mesh is loaded
          console.log('TransformControls initialized successfully');
        } else {
          console.error('THREE.TransformControls is not available');
        }
      } catch (error) {
        console.error('Error initializing TransformControls:', error);
        // Continue without transform controls if there's an error
      }
      
      // Store objects in ref
      threeObjects.current = {
        scene,
        camera,
        renderer,
        controls,
        mesh: null,
        animationId: null,
        gridHelper,
        axesHelper,
        measurementLine: null,
        raycaster,
        mouse,
        transformControls
      };
      
      // Add loading indicator as a DOM element
      const loadingDiv = document.createElement('div');
      loadingDiv.style.position = 'absolute';
      loadingDiv.style.top = '0';
      loadingDiv.style.left = '0';
      loadingDiv.style.width = '100%';
      loadingDiv.style.height = '100%';
      loadingDiv.style.display = 'flex';
      loadingDiv.style.alignItems = 'center';
      loadingDiv.style.justifyContent = 'center';
      loadingDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      loadingDiv.style.color = 'white';
      loadingDiv.style.fontSize = '16px';
      loadingDiv.style.zIndex = '10';
      loadingDiv.textContent = 'Loading model...';
      loadingDiv.id = 'loading-indicator';
      containerRef.current.appendChild(loadingDiv);
      
      // Add measurement UI
      const measurementUI = document.createElement('div');
      measurementUI.style.position = 'absolute';
      measurementUI.style.bottom = '10px';
      measurementUI.style.left = '10px';
      measurementUI.style.padding = '5px 10px';
      measurementUI.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      measurementUI.style.color = 'white';
      measurementUI.style.borderRadius = '4px';
      measurementUI.style.fontSize = '14px';
      measurementUI.style.zIndex = '20';
      measurementUI.style.display = 'flex';
      measurementUI.style.flexDirection = 'column';
      measurementUI.style.gap = '5px';
      measurementUI.id = 'measurement-ui';
      
      // Add measurement button
      const measureButton = document.createElement('button');
      measureButton.textContent = 'Measure Distance';
      measureButton.style.padding = '5px 10px';
      measureButton.style.backgroundColor = '#4f46e5';
      measureButton.style.border = 'none';
      measureButton.style.borderRadius = '4px';
      measureButton.style.color = 'white';
      measureButton.style.cursor = 'pointer';
      measureButton.onclick = () => {
        setIsMeasuring(prev => !prev);
        setMeasurePoints([]);
        setMeasureDistance(null);
        
        // Update button text based on state
        if (!isMeasuring) {
          measureButton.textContent = 'Cancel Measurement';
          measureButton.style.backgroundColor = '#ef4444';
          measurementInfo.textContent = 'Click on two points to measure distance';
        } else {
          measureButton.textContent = 'Measure Distance';
          measureButton.style.backgroundColor = '#4f46e5';
          measurementInfo.textContent = '';
          
          // Remove measurement line if it exists
          if (threeObjects.current.measurementLine) {
            threeObjects.current.scene.remove(threeObjects.current.measurementLine);
            threeObjects.current.measurementLine = null;
          }
        }
      };
      measurementUI.appendChild(measureButton);
      
      // Add measurement info
      const measurementInfo = document.createElement('div');
      measurementInfo.id = 'measurement-info';
      measurementInfo.style.fontSize = '12px';
      measurementUI.appendChild(measurementInfo);
      
      containerRef.current.appendChild(measurementUI);
      
      // Add click event listener for measurements
      renderer.domElement.addEventListener('click', handleMeasurementClick);
      
      return true;
    } catch (err) {
      console.error('Error initializing Three.js:', err);
      setError('Failed to initialize 3D viewer: ' + err.message);
      setLoading(false);
      return false;
    }
  }, [isMeasuring]);
  
  // Handle measurement clicks
  const handleMeasurementClick = React.useCallback((event) => {
    if (!isMeasuring || !threeObjects.current.mesh) return;
    
    const { raycaster, mouse, camera, scene, mesh } = threeObjects.current;
    
    // Calculate mouse position in normalized device coordinates
    const rect = event.target.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Update the raycaster
    raycaster.setFromCamera(mouse, camera);
    
    // Calculate intersections
    const intersects = raycaster.intersectObject(mesh);
    
    if (intersects.length > 0) {
      // Get intersection point
      const point = intersects[0].point;
      
      // Add point to measurement points
      setMeasurePoints(prev => {
        const newPoints = [...prev, point];
        
        // If we have two points, calculate distance
        if (newPoints.length === 2) {
          const distance = newPoints[0].distanceTo(newPoints[1]);
          setMeasureDistance(distance);
          
          // Create a line between the two points
          const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
          const geometry = new THREE.BufferGeometry().setFromPoints(newPoints);
          const line = new THREE.Line(geometry, material);
          
          // Remove existing line if it exists
          if (threeObjects.current.measurementLine) {
            scene.remove(threeObjects.current.measurementLine);
          }
          
          // Add new line
          scene.add(line);
          threeObjects.current.measurementLine = line;
          
          // Update measurement info
          const measurementInfo = document.getElementById('measurement-info');
          if (measurementInfo) {
            measurementInfo.textContent = `Distance: ${distance.toFixed(2)} units`;
          }
        }
        
        return newPoints;
      });
    }
  }, [isMeasuring]);
  
  // Handle window resize
  const handleResize = React.useCallback(() => {
    if (!containerRef.current || !threeObjects.current.renderer || !threeObjects.current.camera) return;
    
    const { renderer, camera } = threeObjects.current;
    
    camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
    camera.updateProjectionMatrix();
    
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
  }, []);
  
  // Animation loop
  const animate = React.useCallback(() => {
    const { renderer, scene, camera, controls } = threeObjects.current;
    
    if (!renderer || !scene || !camera) return;
    
    // Update controls
    if (controls) {
      controls.update();
    }
    
    // Render scene
    renderer.render(scene, camera);
    
    // Continue animation loop
    const animationId = requestAnimationFrame(animate);
    threeObjects.current.animationId = animationId;
    window.modelViewerAnimationId = animationId; // Store in global for external cleanup
  }, []);
  
  // Handle keyboard shortcuts (Blender-like)
  const handleKeyDown = React.useCallback((event) => {
    const { key, shiftKey, ctrlKey, altKey } = event;
    const { mesh, scene, camera, controls, transformControls } = threeObjects.current;
    
    if (!mesh) return;
    
    // Only handle keyboard shortcuts if this is the active instance
    if (window.modelViewerGlobals.activeInstance !== instanceId.current) {
      return;
    }
    
    console.log(`Instance ${instanceId.current}: Key pressed: ${key}`);
    
    // Prevent default browser actions for these keys
    if (['g', 'r', 's', 'x', 'y', 'z', 'Escape'].includes(key)) {
      event.preventDefault();
    }
    
    // Check if transform controls are available
    if (!transformControls) {
      console.warn('TransformControls not available for keyboard shortcuts');
      if (['g', 'r', 's'].includes(key)) {
        const transformUI = document.getElementById('transform-ui');
        if (transformUI) {
          transformUI.textContent = 'Transform controls not available. Try reloading the page.';
          transformUI.style.color = '#ff5555';
          
          // Clear message after 3 seconds
          setTimeout(() => {
            if (transformUI) {
              transformUI.textContent = '';
              transformUI.style.color = 'white';
            }
          }, 3000);
        }
      }
      return;
    }
    
    try {
      // Transform mode keys
      if (key === 'g') {
        console.log('Entering translate mode');
        transformControls.setMode('translate');
        transformControls.visible = true;
        
        // Show transform UI
        const transformUI = document.getElementById('transform-ui');
        if (transformUI) transformUI.textContent = 'Mode: Translate (G) | Press X, Y, Z to constrain axis | ESC to cancel';
        
        return;
      }
      
      if (key === 'r') {
        console.log('Entering rotate mode');
        transformControls.setMode('rotate');
        transformControls.visible = true;
        
        // Show transform UI
        const transformUI = document.getElementById('transform-ui');
        if (transformUI) transformUI.textContent = 'Mode: Rotate (R) | Press X, Y, Z to constrain axis | ESC to cancel';
        
        return;
      }
      
      if (key === 's') {
        console.log('Entering scale mode');
        transformControls.setMode('scale');
        transformControls.visible = true;
        
        // Show transform UI
        const transformUI = document.getElementById('transform-ui');
        if (transformUI) transformUI.textContent = 'Mode: Scale (S) | Press X, Y, Z to constrain axis | ESC to cancel';
        
        return;
      }
      
      // Axis constraint keys - map standard 3D software axes to Three.js axes
      if (['x', 'y', 'z'].includes(key.toLowerCase())) {
        // Create a mapping between standard 3D software keys and Three.js axes
        const keyToThreeAxis = {
          'x': 'x',  // X in standard is X in Three.js
          'y': 'y',  // Y in standard is Y in Three.js (green)
          'z': 'z'   // Z in standard is Z in Three.js (blue)
        };
        
        const threeAxis = keyToThreeAxis[key.toLowerCase()];
        const standardAxis = key.toUpperCase();
        
        console.log(`Constraining to ${standardAxis} axis (${threeAxis} in Three.js)`);
        
        // Set the space to 'world' for consistent axis orientation
        transformControls.setSpace('world');
        
        // Check if we're already showing only this axis
        const isOnlyThisAxisShown = 
          (threeAxis === 'x' && transformControls.showX && 
           !transformControls.showY && !transformControls.showZ) ||
          (threeAxis === 'y' && transformControls.showY && 
           !transformControls.showX && !transformControls.showZ) ||
          (threeAxis === 'z' && transformControls.showZ && 
           !transformControls.showX && !transformControls.showY);
        
        if (isOnlyThisAxisShown) {
          // If only this axis is shown, show all axes
          transformControls.showX = true;
          transformControls.showY = true;
          transformControls.showZ = true;
        } else {
          // Otherwise, show only this axis
          transformControls.showX = (threeAxis === 'x');
          transformControls.showY = (threeAxis === 'y');
          transformControls.showZ = (threeAxis === 'z');
        }
        
        // Update transform UI
        const transformUI = document.getElementById('transform-ui');
        if (transformUI) {
          const mode = transformControls.mode.charAt(0).toUpperCase() + transformControls.mode.slice(1);
          const modeKey = transformControls.mode === 'translate' ? 'G' : transformControls.mode === 'rotate' ? 'R' : 'S';
          
          if (transformControls.showX && 
              transformControls.showY && 
              transformControls.showZ) {
            transformUI.textContent = `Mode: ${mode} (${modeKey}) | All axes | ESC to cancel`;
          } else {
            // Get the label for the visible axis
            let axisLabel = standardAxis;
            
            transformUI.textContent = `Mode: ${mode} (${modeKey}) | Axis: ${axisLabel} | ESC to cancel`;
          }
        }
        
        return;
      }
      
      // Cancel transform
      if (key === 'Escape' && transformControls.visible) {
        console.log('Canceling transform mode');
        transformControls.visible = false;
        
        // Hide transform UI
        const transformUI = document.getElementById('transform-ui');
        if (transformUI) transformUI.textContent = '';
        
        return;
      }
    } catch (error) {
      console.error('Error handling keyboard shortcut:', error);
      const transformUI = document.getElementById('transform-ui');
      if (transformUI) {
        transformUI.textContent = 'Error with transform controls. Try reloading the page.';
        transformUI.style.color = '#ff5555';
        
        // Clear message after 3 seconds
        setTimeout(() => {
          if (transformUI) {
            transformUI.textContent = '';
            transformUI.style.color = 'white';
          }
        }, 3000);
      }
    }
    
    // Toggle help
    if (key === 'h') {
      console.log('Toggling help panel');
      setShowHelp(prev => !prev);
      return;
    }
  }, []);
  
  // Store the keydown handler globally so it can be properly removed during cleanup
  window.modelViewerKeydownHandler = handleKeyDown;
  
  // Load the model
  const loadModel = React.useCallback(async (modelUrl, fileExtension) => {
    const { scene } = threeObjects.current;
    if (!scene) return;
    
    // Always allow the active instance to load the model
    if (window.modelViewerGlobals.activeInstance !== instanceId.current) {
      console.log(`Instance ${instanceId.current}: Not the active instance, but allowing model load anyway`);
      // Continue loading anyway
    }
    
    // Check if we already have a model loaded
    if (threeObjects.current.mesh) {
      console.log(`Instance ${instanceId.current}: Model already loaded, but reloading anyway`);
      // Continue loading anyway
    }
    
    try {
      // Remove any existing mesh from the scene first
      if (threeObjects.current.mesh) {
        scene.remove(threeObjects.current.mesh);
        if (threeObjects.current.mesh.geometry) {
          threeObjects.current.mesh.geometry.dispose();
        }
        if (threeObjects.current.mesh.material) {
          if (Array.isArray(threeObjects.current.mesh.material)) {
            threeObjects.current.mesh.material.forEach(material => material.dispose());
          } else {
            threeObjects.current.mesh.material.dispose();
          }
        }
        threeObjects.current.mesh = null;
      }
      
      if (fileExtension === 'stl') {
        const loader = new THREE.STLLoader();
        
        loader.load(
          modelUrl,
          (geometry) => {
            console.log('STL model loaded successfully');
            
            // Remove loading indicator
            const loadingIndicator = document.getElementById('loading-indicator');
            if (loadingIndicator && loadingIndicator.parentNode) {
              loadingIndicator.parentNode.removeChild(loadingIndicator);
            }
            
            const material = new THREE.MeshPhongMaterial({
              color: 0xf1f1f1,  // Light gray color
              specular: 0x111111,
              shininess: 200
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            
            // Center the model
            geometry.computeBoundingBox();
            const center = geometry.boundingBox.getCenter(new THREE.Vector3());
            mesh.position.sub(center);
            
            // Scale model to fit view
            const boundingBox = new THREE.Box3().setFromObject(mesh);
            const size = boundingBox.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 30 / maxDim;  // Smaller scale to fit with grid
            mesh.scale.multiplyScalar(scale);
            
            // Add mesh to scene
            scene.add(mesh);
            threeObjects.current.mesh = mesh;
            
            // Don't scale grid with model anymore
            // threeObjects.current.gridHelper.scale.set(scale, scale, scale);
            
            // Attach transform controls to the mesh
            if (threeObjects.current.transformControls) {
              try {
                threeObjects.current.transformControls.attach(mesh);
                threeObjects.current.transformControls.visible = true;
                threeObjects.current.transformControls.enabled = true;
                console.log('TransformControls attached to mesh successfully');
              } catch (error) {
                console.error('Error attaching TransformControls to mesh:', error);
                // Continue without transform controls if there's an error
              }
            }
            
            setModelLoaded(true);
            setLoading(false);
            
            // Add transform UI
            addTransformUI();
          },
          (xhr) => {
            if (xhr.lengthComputable) {
              const percentComplete = xhr.loaded / xhr.total * 100;
              console.log(percentComplete.toFixed(2) + '% loaded');
              
              // Update loading indicator
              const loadingIndicator = document.getElementById('loading-indicator');
              if (loadingIndicator) {
                loadingIndicator.textContent = `Loading model: ${percentComplete.toFixed(0)}%`;
              }
            }
          },
          (err) => {
            console.error('Error loading STL model:', err);
            setError('Error loading STL model: ' + (err.message || 'Unknown error'));
            setLoading(false);
          }
        );
      } else if (fileExtension === '3mf') {
        // For 3MF files, show a placeholder since we don't have a 3MF loader
        console.log('3MF file detected, showing placeholder');
        
        // Remove loading indicator
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator && loadingIndicator.parentNode) {
          loadingIndicator.parentNode.removeChild(loadingIndicator);
        }
        
        // Show message in the container
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div style="
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              background-color: #121212;
              color: white;
              text-align: center;
              padding: 20px;
            ">
              <div style="font-size: 24px; margin-bottom: 10px;">📦</div>
              <div style="font-size: 16px;">3MF file detected</div>
              <div style="font-size: 14px; margin-top: 10px; color: #aaa;">
                3MF preview is not yet supported
              </div>
            </div>
          `;
        }
        
        setLoading(false);
      } else {
        // For other file types
        console.log('Unsupported file type:', fileExtension);
        
        // Remove loading indicator
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator && loadingIndicator.parentNode) {
          loadingIndicator.parentNode.removeChild(loadingIndicator);
        }
        
        // Show message in the container
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div style="
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              background-color: #121212;
              color: white;
              text-align: center;
              padding: 20px;
            ">
              <div style="font-size: 24px; margin-bottom: 10px;">❓</div>
              <div style="font-size: 16px;">Unsupported file type: ${fileExtension}</div>
              <div style="font-size: 14px; margin-top: 10px; color: #aaa;">
                Only STL files are currently supported for preview
              </div>
            </div>
          `;
        }
        
        setLoading(false);
      }
    } catch (err) {
      console.error('Error loading model:', err);
      setError('Error loading model: ' + (err.message || 'Unknown error'));
      setLoading(false);
    }
  }, []);
  
  // Add transform UI
  const addTransformUI = () => {
    if (!containerRef.current) return;
    
    // Create main control panel container
    const controlPanel = document.createElement('div');
    controlPanel.style.position = 'absolute';
    controlPanel.style.bottom = '10px';
    controlPanel.style.left = '10px';
    controlPanel.style.padding = '12px';
    controlPanel.style.backgroundColor = 'rgba(30, 30, 30, 0.85)';
    controlPanel.style.color = 'white';
    controlPanel.style.borderRadius = '6px';
    controlPanel.style.fontSize = '14px';
    controlPanel.style.zIndex = '30';
    controlPanel.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    controlPanel.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.3)';
    controlPanel.style.backdropFilter = 'blur(10px)';
    controlPanel.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    controlPanel.style.width = '280px';
    controlPanel.id = 'model-control-panel';
    
    // Create panel header
    const panelHeader = document.createElement('div');
    panelHeader.style.display = 'flex';
    panelHeader.style.justifyContent = 'space-between';
    panelHeader.style.alignItems = 'center';
    panelHeader.style.marginBottom = '10px';
    panelHeader.style.paddingBottom = '8px';
    panelHeader.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
    
    const panelTitle = document.createElement('div');
    panelTitle.textContent = 'Model Controls';
    panelTitle.style.fontWeight = 'bold';
    panelTitle.style.fontSize = '16px';
    
    const minimizeButton = document.createElement('button');
    minimizeButton.innerHTML = '&minus;';
    minimizeButton.style.background = 'none';
    minimizeButton.style.border = 'none';
    minimizeButton.style.color = 'white';
    minimizeButton.style.fontSize = '18px';
    minimizeButton.style.cursor = 'pointer';
    minimizeButton.style.width = '24px';
    minimizeButton.style.height = '24px';
    minimizeButton.style.display = 'flex';
    minimizeButton.style.justifyContent = 'center';
    minimizeButton.style.alignItems = 'center';
    minimizeButton.style.padding = '0';
    minimizeButton.title = 'Minimize panel';
    
    let isPanelMinimized = false;
    const panelContent = document.createElement('div');
    panelContent.id = 'panel-content';
    
    minimizeButton.addEventListener('click', () => {
      isPanelMinimized = !isPanelMinimized;
      panelContent.style.display = isPanelMinimized ? 'none' : 'block';
      minimizeButton.innerHTML = isPanelMinimized ? '&#43;' : '&minus;';
      minimizeButton.title = isPanelMinimized ? 'Expand panel' : 'Minimize panel';
    });
    
    panelHeader.appendChild(panelTitle);
    panelHeader.appendChild(minimizeButton);
    
    // Create transform UI container
    const transformUIContainer = document.createElement('div');
    transformUIContainer.style.padding = '8px 10px';
    transformUIContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
    transformUIContainer.style.color = 'white';
    transformUIContainer.style.borderRadius = '4px';
    transformUIContainer.style.fontSize = '14px';
    transformUIContainer.style.marginBottom = '10px';
    transformUIContainer.style.fontFamily = 'monospace';
    transformUIContainer.id = 'transform-ui';
    
    // Create transform buttons section
    const transformButtonsSection = document.createElement('div');
    transformButtonsSection.style.display = 'flex';
    transformButtonsSection.style.gap = '8px';
    transformButtonsSection.style.marginBottom = '10px';
    
    // Create transform buttons with icons
    const createTransformButton = (label, shortcut, action, icon) => {
      const button = document.createElement('button');
      button.style.display = 'flex';
      button.style.flexDirection = 'column';
      button.style.alignItems = 'center';
      button.style.padding = '8px';
      button.style.backgroundColor = 'rgba(79, 70, 229, 0.2)';
      button.style.border = '1px solid rgba(79, 70, 229, 0.4)';
      button.style.borderRadius = '4px';
      button.style.color = 'white';
      button.style.cursor = 'pointer';
      button.style.flex = '1';
      button.title = `${label} (${shortcut})`;
      
      const iconElement = document.createElement('div');
      iconElement.innerHTML = icon;
      iconElement.style.fontSize = '18px';
      iconElement.style.marginBottom = '4px';
      
      const labelElement = document.createElement('div');
      labelElement.textContent = label;
      labelElement.style.fontSize = '12px';
      
      const shortcutElement = document.createElement('div');
      shortcutElement.textContent = `(${shortcut})`;
      shortcutElement.style.fontSize = '10px';
      shortcutElement.style.opacity = '0.7';
      
      button.appendChild(iconElement);
      button.appendChild(labelElement);
      button.appendChild(shortcutElement);
      
      button.addEventListener('click', action);
      
      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = 'rgba(79, 70, 229, 0.4)';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = 'rgba(79, 70, 229, 0.2)';
      });
      
      return button;
    };
    
    // Create transform buttons
    const moveButton = createTransformButton('Move', 'G', () => {
      if (threeObjects.current.transformControls) {
        try {
          threeObjects.current.transformControls.setMode('translate');
          threeObjects.current.transformControls.visible = true;
        } catch (error) {
          console.error('Error setting transform mode to translate:', error);
          showTransformError();
        }
      } else {
        console.warn('TransformControls not available');
        showTransformError();
      }
    }, '↖');
    
    const rotateButton = createTransformButton('Rotate', 'R', () => {
      if (threeObjects.current.transformControls) {
        try {
          threeObjects.current.transformControls.setMode('rotate');
          threeObjects.current.transformControls.visible = true;
        } catch (error) {
          console.error('Error setting transform mode to rotate:', error);
          showTransformError();
        }
      } else {
        console.warn('TransformControls not available');
        showTransformError();
      }
    }, '↻');
    
    const scaleButton = createTransformButton('Scale', 'S', () => {
      if (threeObjects.current.transformControls) {
        try {
          threeObjects.current.transformControls.setMode('scale');
          threeObjects.current.transformControls.visible = true;
        } catch (error) {
          console.error('Error setting transform mode to scale:', error);
          showTransformError();
        }
      } else {
        console.warn('TransformControls not available');
        showTransformError();
      }
    }, '⤧');
    
    // Helper function to show transform error message
    const showTransformError = () => {
      const transformUI = document.getElementById('transform-ui');
      if (transformUI) {
        transformUI.textContent = 'Transform controls not available. Try reloading the page.';
        transformUI.style.color = '#ff5555';
        
        // Clear message after 3 seconds
        setTimeout(() => {
          if (transformUI) {
            transformUI.textContent = '';
            transformUI.style.color = 'white';
          }
        }, 3000);
      }
    };
    
    transformButtonsSection.appendChild(moveButton);
    transformButtonsSection.appendChild(rotateButton);
    transformButtonsSection.appendChild(scaleButton);
    
    // Create axis constraint section
    const axisSection = document.createElement('div');
    axisSection.style.marginBottom = '10px';
    
    const axisLabel = document.createElement('div');
    axisLabel.textContent = 'Constraint Axis:';
    axisLabel.style.marginBottom = '5px';
    axisLabel.style.fontSize = '12px';
    axisLabel.style.opacity = '0.8';
    
    const axisButtons = document.createElement('div');
    axisButtons.style.display = 'flex';
    axisButtons.style.gap = '8px';
    
    // Create a mapping between standard 3D software labels and Three.js axes
    const axisMapping = {
      'x': { threeAxis: 'x', label: 'X', description: 'Left/Right', color: '#ff5555' },
      'y': { threeAxis: 'y', label: 'Y', description: 'Up/Down', color: '#55ff55' },
      'z': { threeAxis: 'z', label: 'Z', description: 'Forward/Backward', color: '#5555ff' }
    };
    
    const createAxisButton = (standardAxis, config) => {
      const button = document.createElement('button');
      button.textContent = config.label;
      button.style.flex = '1';
      button.style.padding = '5px 0';
      button.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
      button.style.border = `1px solid ${config.color}`;
      button.style.borderRadius = '4px';
      button.style.color = config.color;
      button.style.cursor = 'pointer';
      button.style.fontWeight = 'bold';
      button.title = `Constrain to ${config.label} axis (${config.description})`;
      
      button.addEventListener('click', () => {
        if (threeObjects.current.transformControls) {
          try {
            // Get the corresponding Three.js axis
            const threeAxis = config.threeAxis;
            
            // Set the space to 'world' for consistent axis orientation
            threeObjects.current.transformControls.setSpace('world');
            
            // Check if we're already showing only this axis
            const isOnlyThisAxisShown = 
              (threeAxis === 'x' && threeObjects.current.transformControls.showX && 
               !threeObjects.current.transformControls.showY && !threeObjects.current.transformControls.showZ) ||
              (threeAxis === 'y' && threeObjects.current.transformControls.showY && 
               !threeObjects.current.transformControls.showX && !threeObjects.current.transformControls.showZ) ||
              (threeAxis === 'z' && threeObjects.current.transformControls.showZ && 
               !threeObjects.current.transformControls.showX && !threeObjects.current.transformControls.showY);
            
            if (isOnlyThisAxisShown) {
              // If only this axis is shown, show all axes
              threeObjects.current.transformControls.showX = true;
              threeObjects.current.transformControls.showY = true;
              threeObjects.current.transformControls.showZ = true;
            } else {
              // Otherwise, show only this axis
              threeObjects.current.transformControls.showX = (threeAxis === 'x');
              threeObjects.current.transformControls.showY = (threeAxis === 'y');
              threeObjects.current.transformControls.showZ = (threeAxis === 'z');
            }
            
            // Update transform UI with standard axis label
            const transformUI = document.getElementById('transform-ui');
            if (transformUI) {
              const mode = threeObjects.current.transformControls.mode.charAt(0).toUpperCase() + 
                          threeObjects.current.transformControls.mode.slice(1);
              const modeKey = threeObjects.current.transformControls.mode === 'translate' ? 'G' : 
                             threeObjects.current.transformControls.mode === 'rotate' ? 'R' : 'S';
              
              if (threeObjects.current.transformControls.showX && 
                  threeObjects.current.transformControls.showY && 
                  threeObjects.current.transformControls.showZ) {
                transformUI.textContent = `Mode: ${mode} (${modeKey}) | All axes | ESC to cancel`;
              } else {
                // Get the label for the visible axis
                let axisLabel = config.label;
                
                transformUI.textContent = `Mode: ${mode} (${modeKey}) | Axis: ${axisLabel} | ESC to cancel`;
              }
            }
          } catch (error) {
            console.error(`Error constraining to ${config.label} axis:`, error);
            showTransformError();
          }
        } else {
          // Show message that transform controls must be active
          console.warn('TransformControls not available');
          showTransformError();
        }
      });
      
      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
      });
      
      return button;
    };
    
    // Create buttons with standard 3D software labels
    const xAxisButton = createAxisButton('x', axisMapping.x);
    const yAxisButton = createAxisButton('y', axisMapping.y);
    const zAxisButton = createAxisButton('z', axisMapping.z);
    
    axisButtons.appendChild(xAxisButton);
    axisButtons.appendChild(yAxisButton);
    axisButtons.appendChild(zAxisButton);
    
    axisSection.appendChild(axisLabel);
    axisSection.appendChild(axisButtons);
    
    // Create visibility toggles section
    const visibilitySection = document.createElement('div');
    visibilitySection.style.marginBottom = '10px';
    
    const visibilityLabel = document.createElement('div');
    visibilityLabel.textContent = 'Visibility:';
    visibilityLabel.style.marginBottom = '5px';
    visibilityLabel.style.fontSize = '12px';
    visibilityLabel.style.opacity = '0.8';
    
    // Create toggle function
    const createToggle = (label, initialState, onChange) => {
      const toggleContainer = document.createElement('div');
      toggleContainer.style.display = 'flex';
      toggleContainer.style.justifyContent = 'space-between';
      toggleContainer.style.alignItems = 'center';
      toggleContainer.style.marginBottom = '5px';
      
      const toggleLabel = document.createElement('label');
      toggleLabel.textContent = label;
      toggleLabel.style.flex = '1';
      toggleLabel.style.cursor = 'pointer';
      
      const toggleSwitch = document.createElement('div');
      toggleSwitch.style.position = 'relative';
      toggleSwitch.style.width = '36px';
      toggleSwitch.style.height = '20px';
      
      const toggleInput = document.createElement('input');
      toggleInput.type = 'checkbox';
      toggleInput.checked = initialState;
      toggleInput.style.opacity = '0';
      toggleInput.style.width = '0';
      toggleInput.style.height = '0';
      
      const toggleSlider = document.createElement('span');
      toggleSlider.style.position = 'absolute';
      toggleSlider.style.cursor = 'pointer';
      toggleSlider.style.top = '0';
      toggleSlider.style.left = '0';
      toggleSlider.style.right = '0';
      toggleSlider.style.bottom = '0';
      toggleSlider.style.backgroundColor = initialState ? 'rgba(79, 70, 229, 0.6)' : 'rgba(255, 255, 255, 0.2)';
      toggleSlider.style.borderRadius = '10px';
      toggleSlider.style.transition = 'background-color 0.3s';
      
      const toggleKnob = document.createElement('span');
      toggleKnob.style.position = 'absolute';
      toggleKnob.style.content = '""';
      toggleKnob.style.height = '16px';
      toggleKnob.style.width = '16px';
      toggleKnob.style.left = initialState ? '18px' : '2px';
      toggleKnob.style.bottom = '2px';
      toggleKnob.style.backgroundColor = 'white';
      toggleKnob.style.borderRadius = '50%';
      toggleKnob.style.transition = 'left 0.3s';
      
      // Function to update toggle state
      const updateToggleState = (isChecked) => {
        toggleInput.checked = isChecked;
        toggleSlider.style.backgroundColor = isChecked ? 'rgba(79, 70, 229, 0.6)' : 'rgba(255, 255, 255, 0.2)';
        toggleKnob.style.left = isChecked ? '18px' : '2px';
        
        // Call the onChange handler
        if (typeof onChange === 'function') {
          try {
            onChange(isChecked);
            // Force a render update
            if (threeObjects.current.renderer && threeObjects.current.scene && threeObjects.current.camera) {
              threeObjects.current.renderer.render(threeObjects.current.scene, threeObjects.current.camera);
            }
          } catch (error) {
            console.error('Error in toggle onChange handler:', error);
          }
        }
      };
      
      // Add change event to input
      toggleInput.addEventListener('change', (e) => {
        updateToggleState(e.target.checked);
      });
      
      // Add click events to both label and slider for better UX
      toggleLabel.addEventListener('click', (e) => {
        e.preventDefault();
        updateToggleState(!toggleInput.checked);
      });
      
      toggleSlider.addEventListener('click', (e) => {
        e.preventDefault();
        updateToggleState(!toggleInput.checked);
      });
      
      toggleSlider.appendChild(toggleKnob);
      toggleSwitch.appendChild(toggleInput);
      toggleSwitch.appendChild(toggleSlider);
      
      toggleContainer.appendChild(toggleLabel);
      toggleContainer.appendChild(toggleSwitch);
      
      return toggleContainer;
    };
    
    // Create grid toggle
    const gridToggle = createToggle('Grid', true, (isChecked) => {
      console.log('Grid toggle changed:', isChecked);
      if (threeObjects.current.gridHelper) {
        threeObjects.current.gridHelper.visible = isChecked;
      }
    });
    
    // Create axes toggle
    const axesToggle = createToggle('Axes', true, (isChecked) => {
      console.log('Axes toggle changed:', isChecked);
      if (threeObjects.current.axesHelper) {
        threeObjects.current.axesHelper.visible = isChecked;
      }
    });
    
    // Create wireframe toggle
    const wireframeToggle = createToggle('Wireframe', false, (isChecked) => {
      console.log('Wireframe toggle changed:', isChecked);
      if (threeObjects.current.mesh && threeObjects.current.mesh.material) {
        if (Array.isArray(threeObjects.current.mesh.material)) {
          threeObjects.current.mesh.material.forEach(material => {
            material.wireframe = isChecked;
          });
        } else {
          threeObjects.current.mesh.material.wireframe = isChecked;
        }
      }
    });
    
    visibilitySection.appendChild(visibilityLabel);
    visibilitySection.appendChild(gridToggle);
    visibilitySection.appendChild(axesToggle);
    visibilitySection.appendChild(wireframeToggle);
    
    // Create reset button
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Model Position';
    resetButton.style.width = '100%';
    resetButton.style.padding = '8px';
    resetButton.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
    resetButton.style.border = '1px solid rgba(239, 68, 68, 0.4)';
    resetButton.style.borderRadius = '4px';
    resetButton.style.color = 'white';
    resetButton.style.cursor = 'pointer';
    resetButton.style.marginTop = '5px';
    
    resetButton.addEventListener('click', () => {
      if (threeObjects.current.mesh) {
        // Reset position, rotation and scale
        threeObjects.current.mesh.position.set(0, 0, 0);
        threeObjects.current.mesh.rotation.set(0, 0, 0);
        
        // Get original scale from model loading
        const geometry = threeObjects.current.mesh.geometry;
        geometry.computeBoundingBox();
        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 30 / maxDim;
        
        threeObjects.current.mesh.scale.set(scale, scale, scale);
        
        // Update transform controls
        if (threeObjects.current.transformControls) {
          threeObjects.current.transformControls.update();
        }
      }
    });
    
    resetButton.addEventListener('mouseenter', () => {
      resetButton.style.backgroundColor = 'rgba(239, 68, 68, 0.4)';
    });
    
    resetButton.addEventListener('mouseleave', () => {
      resetButton.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
    });
    
    // Create help button
    const helpButton = document.createElement('button');
    helpButton.textContent = 'Keyboard Shortcuts';
    helpButton.style.width = '100%';
    helpButton.style.padding = '8px';
    helpButton.style.backgroundColor = 'rgba(79, 70, 229, 0.2)';
    helpButton.style.border = '1px solid rgba(79, 70, 229, 0.4)';
    helpButton.style.borderRadius = '4px';
    helpButton.style.color = 'white';
    helpButton.style.cursor = 'pointer';
    helpButton.style.marginTop = '10px';
    
    helpButton.addEventListener('click', () => {
      setShowHelp(prev => !prev);
    });
    
    helpButton.addEventListener('mouseenter', () => {
      helpButton.style.backgroundColor = 'rgba(79, 70, 229, 0.4)';
    });
    
    helpButton.addEventListener('mouseleave', () => {
      helpButton.style.backgroundColor = 'rgba(79, 70, 229, 0.2)';
    });
    
    // Assemble panel content
    panelContent.appendChild(transformUIContainer);
    panelContent.appendChild(transformButtonsSection);
    panelContent.appendChild(axisSection);
    panelContent.appendChild(visibilitySection);
    panelContent.appendChild(resetButton);
    panelContent.appendChild(helpButton);
    
    // Assemble control panel
    controlPanel.appendChild(panelHeader);
    controlPanel.appendChild(panelContent);
    
    // Create help panel
    const helpPanel = document.createElement('div');
    helpPanel.style.position = 'absolute';
    helpPanel.style.top = '50%';
    helpPanel.style.left = '50%';
    helpPanel.style.transform = 'translate(-50%, -50%)';
    helpPanel.style.padding = '20px';
    helpPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    helpPanel.style.color = 'white';
    helpPanel.style.borderRadius = '8px';
    helpPanel.style.fontSize = '14px';
    helpPanel.style.zIndex = '40';
    helpPanel.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    helpPanel.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
    helpPanel.style.backdropFilter = 'blur(10px)';
    helpPanel.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    helpPanel.style.width = '400px';
    helpPanel.style.maxWidth = '90vw';
    helpPanel.style.display = 'none';
    helpPanel.id = 'help-panel';
    
    // Create help panel header
    const helpPanelHeader = document.createElement('div');
    helpPanelHeader.style.display = 'flex';
    helpPanelHeader.style.justifyContent = 'space-between';
    helpPanelHeader.style.alignItems = 'center';
    helpPanelHeader.style.marginBottom = '15px';
    helpPanelHeader.style.paddingBottom = '10px';
    helpPanelHeader.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
    
    const helpPanelTitle = document.createElement('div');
    helpPanelTitle.textContent = 'Keyboard Shortcuts';
    helpPanelTitle.style.fontWeight = 'bold';
    helpPanelTitle.style.fontSize = '18px';
    
    const closeHelpButton = document.createElement('button');
    closeHelpButton.innerHTML = '&times;';
    closeHelpButton.style.background = 'none';
    closeHelpButton.style.border = 'none';
    closeHelpButton.style.color = 'white';
    closeHelpButton.style.fontSize = '24px';
    closeHelpButton.style.cursor = 'pointer';
    closeHelpButton.style.width = '24px';
    closeHelpButton.style.height = '24px';
    closeHelpButton.style.display = 'flex';
    closeHelpButton.style.justifyContent = 'center';
    closeHelpButton.style.alignItems = 'center';
    closeHelpButton.style.padding = '0';
    closeHelpButton.title = 'Close';
    
    closeHelpButton.addEventListener('click', () => {
      setShowHelp(false);
    });
    
    helpPanelHeader.appendChild(helpPanelTitle);
    helpPanelHeader.appendChild(closeHelpButton);
    
    // Create shortcut table
    const shortcutTable = document.createElement('table');
    shortcutTable.style.width = '100%';
    shortcutTable.style.borderCollapse = 'collapse';
    
    // Add table header
    const tableHeader = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const keyHeader = document.createElement('th');
    keyHeader.textContent = 'Key';
    keyHeader.style.textAlign = 'left';
    keyHeader.style.padding = '8px';
    keyHeader.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
    keyHeader.style.width = '30%';
    
    const actionHeader = document.createElement('th');
    actionHeader.textContent = 'Action';
    actionHeader.style.textAlign = 'left';
    actionHeader.style.padding = '8px';
    actionHeader.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
    
    headerRow.appendChild(keyHeader);
    headerRow.appendChild(actionHeader);
    tableHeader.appendChild(headerRow);
    shortcutTable.appendChild(tableHeader);
    
    // Add table body
    const tableBody = document.createElement('tbody');
    
    // Define shortcuts
    const shortcuts = [
      { key: 'G', action: 'Grab/Move object' },
      { key: 'R', action: 'Rotate object' },
      { key: 'S', action: 'Scale object' },
      { key: 'X', action: 'Constrain to X axis' },
      { key: 'Y', action: 'Constrain to Y axis' },
      { key: 'Z', action: 'Constrain to Z axis' },
      { key: 'ESC', action: 'Cancel current operation' },
      { key: 'H', action: 'Toggle help panel' },
      { key: 'Mouse Wheel', action: 'Zoom in/out' },
      { key: 'Middle Mouse', action: 'Orbit view' },
      { key: 'Shift + Middle Mouse', action: 'Pan view' }
    ];
    
    // Add shortcuts to table
    shortcuts.forEach(shortcut => {
      const row = document.createElement('tr');
      
      const keyCell = document.createElement('td');
      keyCell.style.padding = '8px';
      keyCell.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
      
      const keySpan = document.createElement('span');
      keySpan.textContent = shortcut.key;
      keySpan.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
      keySpan.style.padding = '2px 6px';
      keySpan.style.borderRadius = '4px';
      keySpan.style.fontFamily = 'monospace';
      
      keyCell.appendChild(keySpan);
      
      const actionCell = document.createElement('td');
      actionCell.textContent = shortcut.action;
      actionCell.style.padding = '8px';
      actionCell.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
      
      row.appendChild(keyCell);
      row.appendChild(actionCell);
      tableBody.appendChild(row);
    });
    
    shortcutTable.appendChild(tableBody);
    
    // Add note at the bottom
    const helpNote = document.createElement('p');
    helpNote.textContent = 'Note: These shortcuts mimic Blender\'s transformation system for a familiar workflow.';
    helpNote.style.marginTop = '15px';
    helpNote.style.fontSize = '12px';
    helpNote.style.opacity = '0.7';
    helpNote.style.fontStyle = 'italic';
    
    // Add coordinate system explanation
    const coordSystemNote = document.createElement('div');
    coordSystemNote.style.marginTop = '15px';
    coordSystemNote.style.padding = '10px';
    coordSystemNote.style.backgroundColor = 'rgba(79, 70, 229, 0.1)';
    coordSystemNote.style.borderRadius = '4px';
    coordSystemNote.style.fontSize = '12px';
    
    const coordTitle = document.createElement('div');
    coordTitle.textContent = 'Coordinate System';
    coordTitle.style.fontWeight = 'bold';
    coordTitle.style.marginBottom = '5px';
    
    const coordDesc = document.createElement('div');
    coordDesc.innerHTML = `
      <div style="margin-bottom: 5px;">Standard 3D coordinate system:</div>
      <div style="display: flex; margin-bottom: 3px;">
        <span style="color: #ff5555; width: 20px; font-weight: bold;">X:</span>
        <span>Left/Right (Red)</span>
      </div>
      <div style="display: flex; margin-bottom: 3px;">
        <span style="color: #55ff55; width: 20px; font-weight: bold;">Y:</span>
        <span>Forward/Backward (Green)</span>
      </div>
      <div style="display: flex;">
        <span style="color: #5555ff; width: 20px; font-weight: bold;">Z:</span>
        <span>Up/Down (Blue)</span>
      </div>
    `;
    
    coordSystemNote.appendChild(coordTitle);
    coordSystemNote.appendChild(coordDesc);
    
    // Assemble help panel
    helpPanel.appendChild(helpPanelHeader);
    helpPanel.appendChild(shortcutTable);
    helpPanel.appendChild(helpNote);
    helpPanel.appendChild(coordSystemNote);
    
    // Add UI elements to container
    containerRef.current.appendChild(controlPanel);
    containerRef.current.appendChild(helpPanel);
  };
  
  // Toggle help panel visibility
  React.useEffect(() => {
    const helpPanel = document.getElementById('help-panel');
    if (helpPanel) {
      helpPanel.style.display = showHelp ? 'block' : 'none';
    }
  }, [showHelp]);
  
  // Effect to initialize and load model
  React.useEffect(() => {
    if (!containerRef.current) return;
    
    console.log(`Instance ${instanceId.current}: Loading model from path:`, filePath);
    
    if (!filePath) {
      setError('No file path provided');
      setLoading(false);
      return;
    }
    
    // Get file extension
    const fileExtension = filePath.split('.').pop().toLowerCase();
    console.log('File extension:', fileExtension);
    
    // Initialize Three.js
    const initialized = initThreeJs();
    if (!initialized) return;
    
    // Mark as initialized
    isInitializedRef.current = true;
    
    // Start animation loop
    animate();
    
    // Add window resize listener
    window.addEventListener('resize', handleResize);
    
    // Check if file exists and load model
    const checkFileAndLoad = async () => {
      // Always allow the active instance to check the file
      if (window.modelViewerGlobals.activeInstance !== instanceId.current) {
        console.log(`Instance ${instanceId.current}: Not the active instance, but allowing file check anyway`);
        // Continue checking anyway
      }
      
      // Always allow checking even if we already have a model loaded
      if (threeObjects.current.mesh) {
        console.log(`Instance ${instanceId.current}: Model already loaded, but checking file anyway`);
        // Continue checking anyway
      }
      
      try {
        // First check if the file exists
        const response = await fetch('/api/file-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath })
        });
        
        const data = await response.json();
        console.log('File check result:', data);
        
        if (!data.exists) {
          throw new Error(`File not found: ${filePath}`);
        }
        
        if (!data.allowed) {
          throw new Error(`File access not allowed: ${filePath}`);
        }
        
        // Encode the file path to make it URL-safe
        const encodedPath = encodeURIComponent(filePath);
        const modelUrl = `/api/model/${encodedPath}`;
        console.log('Model URL:', modelUrl);
        
        // Load the model
        await loadModel(modelUrl, fileExtension);
      } catch (err) {
        console.error('Error checking file:', err);
        
        // Show error in the container
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div style="
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              background-color: #121212;
              color: #ff4444;
              text-align: center;
              padding: 20px;
            ">
              <div style="font-size: 24px; margin-bottom: 10px;">⚠️</div>
              <div style="font-size: 16px;">${err.message || 'Error loading model'}</div>
            </div>
          `;
        }
        
        setError(err.message || 'Error loading model');
        setLoading(false);
      }
    };
    
    checkFileAndLoad();
    
    // Cleanup function
    return () => {
      console.log(`Instance ${instanceId.current}: Component unmounting, cleaning up`);
      
      // Reset initialization flag
      isInitializedRef.current = false;
      
      // Reset global initialization state if this is the active instance
      if (window.modelViewerGlobals.activeInstance === instanceId.current) {
        window.modelViewerGlobals.isInitialized = false;
        window.modelViewerGlobals.activeInstance = null;
      }
      
      window.removeEventListener('resize', handleResize);
      
      // Cancel animation frame
      if (threeObjects.current.animationId) {
        cancelAnimationFrame(threeObjects.current.animationId);
        threeObjects.current.animationId = null;
      }
      
      // Remove event listeners
      const { renderer } = threeObjects.current;
      if (renderer && renderer.domElement) {
        renderer.domElement.removeEventListener('click', handleMeasurementClick);
      }
      
      // Remove keyboard and mouse event listeners
      window.removeEventListener('keydown', handleKeyDown);
      
      // Clean up the scene and resources
      const { scene, controls, mesh, measurementLine } = threeObjects.current;
      
      // Dispose mesh
      if (mesh) {
        if (scene) scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(material => material.dispose());
          } else {
            mesh.material.dispose();
          }
        }
        threeObjects.current.mesh = null;
      }
      
      // Dispose measurement line
      if (measurementLine) {
        if (scene) scene.remove(measurementLine);
        if (measurementLine.geometry) measurementLine.geometry.dispose();
        if (measurementLine.material) measurementLine.material.dispose();
        threeObjects.current.measurementLine = null;
      }
      
      // Dispose controls
      if (controls) {
        controls.dispose();
        threeObjects.current.controls = null;
      }
      
      // Dispose renderer
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
          try {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
          } catch (e) {
            console.error('Error removing renderer DOM element:', e);
          }
        }
        threeObjects.current.renderer = null;
      }
      
      // Clear scene
      if (scene) {
        while(scene.children.length > 0) { 
          const object = scene.children[0];
          scene.remove(object);
        }
        threeObjects.current.scene = null;
      }
      
      // Clean up UI elements
      if (containerRef.current) {
        // Remove control panel
        const controlPanel = document.getElementById('model-control-panel');
        if (controlPanel && controlPanel.parentNode) {
          controlPanel.parentNode.removeChild(controlPanel);
        }
        
        // Remove help panel
        const helpPanel = document.getElementById('help-panel');
        if (helpPanel && helpPanel.parentNode) {
          helpPanel.parentNode.removeChild(helpPanel);
        }
        
        // Remove transform UI
        const transformUI = document.getElementById('transform-ui');
        if (transformUI && transformUI.parentNode) {
          transformUI.parentNode.removeChild(transformUI);
        }
        
        // Remove measurement UI
        const measurementUI = document.getElementById('measurement-ui');
        if (measurementUI && measurementUI.parentNode) {
          measurementUI.parentNode.removeChild(measurementUI);
        }
      }
      
      // Reset state
      setModelLoaded(false);
      setTransformMode(null);
      setTransformAxis(null);
      setShowHelp(false);
      setIsMeasuring(false);
      setMeasurePoints([]);
      setMeasureDistance(null);
    };
  }, [filePath, initThreeJs, animate, handleResize, loadModel, handleMeasurementClick, handleKeyDown]);
  
  // Add event listeners
  React.useEffect(() => {
    // Only add event listeners once the model is loaded
    if (!modelLoaded) return;
    
    // Only add event listeners if this is the active instance
    if (window.modelViewerGlobals.activeInstance !== instanceId.current) {
      console.log(`Instance ${instanceId.current}: Not the active instance, skipping event listeners`);
      return;
    }
    
    console.log(`Instance ${instanceId.current}: Adding event listeners for keyboard and mouse interactions`);
    
    // Add event listeners to the document to ensure they're captured even when mouse moves outside the container
    document.addEventListener('keydown', window.modelViewerKeydownHandler);
    
    // Add mousedown event listener to the container to start transform operations
    const container = containerRef.current;
    const handleMouseDown = (event) => {
      // Only handle left mouse button
      if (event.button === 0 && threeObjects.current.transformControls && threeObjects.current.transformControls.visible) {
        console.log(`Instance ${instanceId.current}: Mouse down with transform controls visible`);
        // Prevent default to avoid text selection
        event.preventDefault();
      }
    };
    
    if (container) {
      container.addEventListener('mousedown', handleMouseDown);
    }
    
    return () => {
      console.log('Removing event listeners for keyboard and mouse interactions');
      document.removeEventListener('keydown', window.modelViewerKeydownHandler);
      
      if (container) {
        container.removeEventListener('mousedown', handleMouseDown);
      }
    };
  }, [handleKeyDown, modelLoaded]);
  
  return React.createElement('div', {
    ref: containerRef,
    className: 'w-full h-full min-h-[400px] relative bg-gray-900'
  });
}; 
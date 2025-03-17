// ModelViewer component v3 - Improved Three.js integration
// Create a global object to track instances across all components
if (!window.modelViewerGlobals) {
  window.modelViewerGlobals = {
    activeInstance: null,
    instanceCount: 0,
    isInitialized: false,
    instances: {} // Track all instances by ID
  };
}

// Define the ModelViewer component and assign it to window
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
    
    // Register this instance
    window.modelViewerGlobals.instances[instanceId.current] = {
      filePath,
      active: true
    };
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
    transformControls: null,
    resizeObserver: null
  });
  
  // Define handleResize at component level
  const handleResize = React.useCallback(() => {
    if (!containerRef.current || !threeObjects.current.renderer || !threeObjects.current.camera) return;
    
    const { renderer, camera } = threeObjects.current;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    console.log(`Instance ${instanceId.current}: Resizing to ${width}x${height}`);
    
    // Update camera aspect ratio
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    // Update renderer size
    renderer.setSize(width, height);
  }, []);
  
  // Create a global cleanup function that can be called from outside the component
  window.threeJsCleanup = function(specificInstanceId = null) {
    // If a specific instance ID is provided, only clean up that instance
    const targetInstanceId = specificInstanceId || instanceId.current;
    
    console.log(`Instance ${targetInstanceId}: Global Three.js cleanup called`);
    
    // Only proceed if this is the target instance
    if (specificInstanceId && specificInstanceId !== instanceId.current) {
      console.log(`Instance ${instanceId.current}: Skipping cleanup as it's not the target instance`);
      return;
    }
    
    // Reset initialization flag
    if (isInitializedRef.current) {
      isInitializedRef.current = false;
    }
    
    // Reset global initialization state if this is the active instance
    if (window.modelViewerGlobals.activeInstance === targetInstanceId) {
      window.modelViewerGlobals.isInitialized = false;
      window.modelViewerGlobals.activeInstance = null;
    }
    
    // Remove event listeners
    document.removeEventListener('keydown', window.modelViewerKeydownHandler);
    window.removeEventListener('resize', handleResize);
    
    // Clean up resize observer if it exists
    if (threeObjects.current.resizeObserver) {
      threeObjects.current.resizeObserver.disconnect();
      threeObjects.current.resizeObserver = null;
    }
    
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
          console.error(`Instance ${targetInstanceId}: Error removing renderer DOM element:`, e);
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
    
    // Remove this instance from the global tracking
    if (window.modelViewerGlobals.instances[targetInstanceId]) {
      delete window.modelViewerGlobals.instances[targetInstanceId];
    }
    
    // Decrement instance count
    window.modelViewerGlobals.instanceCount--;
    console.log(`Instance ${targetInstanceId}: Cleanup complete, remaining instances: ${window.modelViewerGlobals.instanceCount}`);
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
      // Use a lighter background color for better visibility
      scene.background = new THREE.Color(0x2a2a2a);
      
      // Setup camera
      const camera = new THREE.PerspectiveCamera(
        75,
        containerRef.current.clientWidth / containerRef.current.clientHeight,
        0.1,
        1000
      );
      // Position camera closer for better initial view
      camera.position.z = 50;
      
      // Setup renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      );
      
      // Set pixel ratio for better quality on high-DPI displays
      renderer.setPixelRatio(window.devicePixelRatio);
      
      // Clear container before adding new elements
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(renderer.domElement);
      
      // Make sure the renderer canvas fills its container
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      
      // Add resize observer to handle container size changes
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(containerRef.current);
      
      // Store resize observer in ref for cleanup
      threeObjects.current.resizeObserver = resizeObserver;
      
      // Also listen for window resize events
      window.addEventListener('resize', handleResize);
      
      // Add lights
      const ambientLight = new THREE.AmbientLight(0x606060); // Brighter ambient light
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Brighter directional light
      directionalLight.position.set(0, 1, 0);
      scene.add(directionalLight);
      
      // Add a second directional light from another angle
      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
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
  
  // Handle keyboard shortcuts
  const handleKeyDown = React.useCallback((e) => {
    // Only handle keyboard shortcuts if this is the active instance
    if (window.modelViewerGlobals.activeInstance !== instanceId.current) {
      return;
    }
    
    const key = e.key.toLowerCase();
    console.log(`Instance ${instanceId.current}: Key pressed: ${key}`);
    
    try {
      // Transform mode shortcuts
      if (key === 't') {
        setTransformMode(prev => prev === 'translate' ? null : 'translate');
        setTransformAxis(null);
        return;
      }
      
      if (key === 'r') {
        setTransformMode(prev => prev === 'rotate' ? null : 'rotate');
        setTransformAxis(null);
        return;
      }
      
      if (key === 's') {
        setTransformMode(prev => prev === 'scale' ? null : 'scale');
        setTransformAxis(null);
        return;
      }
      
      // Axis constraints
      if (key === 'x') {
        setTransformAxis(prev => prev === 'x' ? null : 'x');
        return;
      }
      
      if (key === 'y') {
        setTransformAxis(prev => prev === 'y' ? null : 'y');
        return;
      }
      
      if (key === 'z') {
        setTransformAxis(prev => prev === 'z' ? null : 'z');
        return;
      }
      
      // Measurement mode
      if (key === 'm') {
        setIsMeasuring(prev => !prev);
        setMeasurePoints([]);
        setMeasureDistance(null);
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
            
            // Use a brighter material for better visibility
            const material = new THREE.MeshPhongMaterial({
              color: 0xf5f5f5,  // Almost white for better visibility
              specular: 0x333333,
              shininess: 30
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
            const scale = 40 / maxDim;  // Larger scale for better visibility
            mesh.scale.multiplyScalar(scale);
            
            // Add mesh to scene
            scene.add(mesh);
            threeObjects.current.mesh = mesh;
            
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
              background-color: #2a2a2a;
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
              background-color: #2a2a2a;
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
    // Create a control panel if it doesn't exist
    const controlPanel = document.getElementById('model-control-panel');
    
    if (controlPanel) {
      // Clear existing content
      while (controlPanel.firstChild) {
        controlPanel.removeChild(controlPanel.firstChild);
      }
    } else {
      // Create a new control panel
      const newPanel = document.createElement('div');
      newPanel.id = 'model-control-panel';
      newPanel.style.position = 'absolute';
      newPanel.style.top = '10px';
      newPanel.style.left = '10px';
      newPanel.style.zIndex = '1000';
      newPanel.style.backgroundColor = 'rgba(15, 23, 42, 0.85)';
      newPanel.style.backdropFilter = 'blur(8px)';
      newPanel.style.borderRadius = '12px';
      newPanel.style.padding = '16px';
      newPanel.style.width = '220px';
      newPanel.style.maxHeight = 'calc(100% - 20px)';
      newPanel.style.overflowY = 'auto';
      newPanel.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.2)';
      newPanel.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      newPanel.style.color = 'white';
      newPanel.style.fontFamily = '"Space Grotesk", sans-serif';
      newPanel.style.transition = '0.3s';
      
      // Add to container
      containerRef.current.appendChild(newPanel);
    }
    
    // Get the panel (either existing or newly created)
    const panel = document.getElementById('model-control-panel');
    
    // Create panel content container
    const panelContent = document.createElement('div');
    panelContent.id = 'panel-content';
    panelContent.style.display = 'flex';
    panelContent.style.flexDirection = 'column';
    panelContent.style.gap = '16px';
    
    // Add title
    const title = document.createElement('h3');
    title.textContent = 'Transform Controls';
    title.style.margin = '0 0 8px 0';
    title.style.fontSize = '16px';
    title.style.fontWeight = '600';
    panelContent.appendChild(title);
    
    // Create transform buttons container
    const transformButtonsContainer = document.createElement('div');
    transformButtonsContainer.style.display = 'grid';
    transformButtonsContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
    transformButtonsContainer.style.gap = '8px';
    
    // Add transform buttons
    const moveButton = createTransformButton('Move', 'G', 'translate', 'move');
    const rotateButton = createTransformButton('Rotate', 'R', 'rotate', 'rotate');
    const scaleButton = createTransformButton('Scale', 'S', 'scale', 'scale');
    
    transformButtonsContainer.appendChild(moveButton);
    transformButtonsContainer.appendChild(rotateButton);
    transformButtonsContainer.appendChild(scaleButton);
    
    // Create axis constraint section
    const axisSection = document.createElement('div');
    axisSection.style.display = 'flex';
    axisSection.style.flexDirection = 'column';
    axisSection.style.gap = '8px';
    
    const axisLabel = document.createElement('div');
    axisLabel.textContent = 'Constraint Axis:';
    axisLabel.style.fontSize = '14px';
    axisLabel.style.fontWeight = '500';
    axisLabel.style.color = 'rgba(255, 255, 255, 0.8)';
    axisLabel.style.marginBottom = '4px';
    
    const axisButtonsContainer = document.createElement('div');
    axisButtonsContainer.style.display = 'grid';
    axisButtonsContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
    axisButtonsContainer.style.gap = '8px';
    
    // Add axis buttons
    const xAxisButton = createAxisButton('x', { color: '#ef4444', key: 'X', label: 'X' });
    const yAxisButton = createAxisButton('y', { color: '#22c55e', key: 'Y', label: 'Y' });
    const zAxisButton = createAxisButton('z', { color: '#3b82f6', key: 'Z', label: 'Z' });
    
    axisButtonsContainer.appendChild(xAxisButton);
    axisButtonsContainer.appendChild(yAxisButton);
    axisButtonsContainer.appendChild(zAxisButton);
    
    axisSection.appendChild(axisLabel);
    axisSection.appendChild(axisButtonsContainer);
    
    // Create visibility section
    const visibilitySection = document.createElement('div');
    visibilitySection.style.display = 'flex';
    visibilitySection.style.flexDirection = 'column';
    visibilitySection.style.gap = '10px';
    
    const visibilityLabel = document.createElement('div');
    visibilityLabel.textContent = 'Visibility:';
    visibilityLabel.style.fontSize = '14px';
    visibilityLabel.style.fontWeight = '500';
    visibilityLabel.style.color = 'rgba(255, 255, 255, 0.8)';
    visibilityLabel.style.marginBottom = '4px';
    
    visibilitySection.appendChild(visibilityLabel);
    
    // Add toggles
    const gridToggle = createToggle('Grid', true, (isChecked) => {
      if (threeObjects.current && threeObjects.current.grid) {
        threeObjects.current.grid.visible = isChecked;
      }
    });
    
    const axesToggle = createToggle('Axes', true, (isChecked) => {
      if (threeObjects.current && threeObjects.current.axesHelper) {
        threeObjects.current.axesHelper.visible = isChecked;
      }
    });
    
    const wireframeToggle = createToggle('Wireframe', false, (isChecked) => {
      console.log('Wireframe toggle changed:', isChecked);
      if (threeObjects.current && threeObjects.current.mesh) {
        if (Array.isArray(threeObjects.current.mesh.material)) {
          // Handle multi-material case
          threeObjects.current.mesh.material.forEach(mat => {
            mat.wireframe = isChecked;
          });
        } else {
          // Handle single material case
          threeObjects.current.mesh.material.wireframe = isChecked;
        }
      }
    });
    
    visibilitySection.appendChild(gridToggle);
    visibilitySection.appendChild(axesToggle);
    visibilitySection.appendChild(wireframeToggle);
    
    // Create reset button
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Model Position';
    resetButton.style.width = '100%';
    resetButton.style.padding = '10px 12px';
    resetButton.style.backgroundColor = '#475569';
    resetButton.style.color = 'white';
    resetButton.style.border = 'none';
    resetButton.style.borderRadius = '6px';
    resetButton.style.cursor = 'pointer';
    resetButton.style.fontWeight = '500';
    resetButton.style.fontSize = '14px';
    resetButton.style.transition = 'all 0.2s ease';
    
    resetButton.addEventListener('mouseenter', () => {
      resetButton.style.backgroundColor = '#64748b';
    });
    
    resetButton.addEventListener('mouseleave', () => {
      resetButton.style.backgroundColor = '#475569';
    });
    
    resetButton.addEventListener('click', () => {
      if (threeObjects.current && threeObjects.current.mesh) {
        threeObjects.current.mesh.position.set(0, 0, 0);
        threeObjects.current.mesh.rotation.set(0, 0, 0);
        threeObjects.current.mesh.scale.set(1, 1, 1);
        
        // Reset camera position
        if (threeObjects.current.camera) {
          threeObjects.current.camera.position.set(0, 0, 5);
          threeObjects.current.camera.lookAt(0, 0, 0);
        }
        
        // Reset controls
        if (threeObjects.current.controls) {
          threeObjects.current.controls.reset();
        }
      }
    });
    
    // Create keyboard shortcuts button
    const shortcutsButton = document.createElement('button');
    shortcutsButton.textContent = 'Keyboard Shortcuts';
    shortcutsButton.style.width = '100%';
    shortcutsButton.style.padding = '10px 12px';
    shortcutsButton.style.backgroundColor = '#1e293b';
    shortcutsButton.style.color = 'white';
    shortcutsButton.style.border = 'none';
    shortcutsButton.style.borderRadius = '6px';
    shortcutsButton.style.cursor = 'pointer';
    shortcutsButton.style.fontWeight = '500';
    shortcutsButton.style.fontSize = '14px';
    shortcutsButton.style.transition = 'all 0.2s ease';
    
    shortcutsButton.addEventListener('mouseenter', () => {
      shortcutsButton.style.backgroundColor = '#334155';
    });
    
    shortcutsButton.addEventListener('mouseleave', () => {
      shortcutsButton.style.backgroundColor = '#1e293b';
    });
    
    shortcutsButton.addEventListener('click', () => {
      alert(
        'Keyboard Shortcuts:\n\n' +
        'G: Activate Move Tool\n' +
        'R: Activate Rotate Tool\n' +
        'S: Activate Scale Tool\n\n' +
        'X: Constrain to X axis (Red)\n' +
        'Y: Constrain to Y axis (Green)\n' +
        'Z: Constrain to Z axis (Blue)\n\n' +
        'Esc: Cancel current operation\n' +
        'Enter: Confirm current operation'
      );
    });
    
    // Assemble panel
    panelContent.appendChild(transformButtonsContainer);
    panelContent.appendChild(axisSection);
    panelContent.appendChild(visibilitySection);
    panelContent.appendChild(resetButton);
    panelContent.appendChild(shortcutsButton);
    
    panel.appendChild(panelContent);
  };
  
  const createTransformButton = (label, shortcut, action, icon) => {
    const button = document.createElement('button');
    button.style.display = 'flex';
    button.style.flexDirection = 'column';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.padding = '12px 8px';
    button.style.backgroundColor = '#1e293b';
    button.style.border = 'none';
    button.style.borderRadius = '8px';
    button.style.cursor = 'pointer';
    button.style.color = 'white';
    button.style.transition = 'all 0.2s ease';
    
    // Create icon
    const iconElement = document.createElement('div');
    iconElement.style.marginBottom = '6px';
    
    if (icon === 'move') {
      iconElement.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 9l-3 3 3 3"></path>
          <path d="M9 5l3-3 3 3"></path>
          <path d="M15 19l3-3 3 3"></path>
          <path d="M19 9l3 3-3 3"></path>
          <path d="M2 12h20"></path>
          <path d="M12 2v20"></path>
        </svg>
      `;
    } else if (icon === 'rotate') {
      iconElement.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6"></path>
          <path d="M2.5 12.5v-6h6"></path>
          <path d="M2.5 12.5a9 9 0 0 0 9 9 9 9 0 0 0 6.54-2.77"></path>
          <path d="M21.5 2a9 9 0 0 0-9 9 9 9 0 0 0-2.77 6.54"></path>
        </svg>
      `;
    } else if (icon === 'scale') {
      iconElement.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 3L3 21"></path>
          <path d="M21 21L3 3"></path>
        </svg>
      `;
    }
    
    // Create label
    const labelElement = document.createElement('div');
    labelElement.textContent = label;
    labelElement.style.fontSize = '12px';
    labelElement.style.fontWeight = '500';
    
    // Create shortcut indicator
    const shortcutElement = document.createElement('div');
    shortcutElement.textContent = `(${shortcut})`;
    shortcutElement.style.fontSize = '10px';
    shortcutElement.style.opacity = '0.7';
    shortcutElement.style.marginTop = '2px';
    
    button.appendChild(iconElement);
    button.appendChild(labelElement);
    button.appendChild(shortcutElement);
    
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#334155';
      button.style.transform = 'translateY(-2px)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#1e293b';
      button.style.transform = 'translateY(0)';
    });
    
    button.addEventListener('click', () => {
      if (threeObjects.current && threeObjects.current.transformControls) {
        const mode = action;
        threeObjects.current.transformControls.setMode(mode);
        threeObjects.current.transformControls.attach(threeObjects.current.mesh);
        
        // Update active state of buttons
        const allButtons = document.querySelectorAll('#model-control-panel button');
        allButtons.forEach(btn => {
          if (btn === button) {
            btn.style.backgroundColor = '#3b82f6';
          } else if (btn.classList.contains('transform-button')) {
            btn.style.backgroundColor = '#1e293b';
          }
        });
        
        button.classList.add('active');
      } else {
        showTransformError();
      }
    });
    
    button.classList.add('transform-button');
    return button;
  };
  
  const createAxisButton = (standardAxis, config) => {
    const button = document.createElement('button');
    button.textContent = config.label;
    button.style.padding = '8px 0';
    button.style.backgroundColor = '#1e293b';
    button.style.color = config.color;
    button.style.border = 'none';
    button.style.borderRadius = '6px';
    button.style.cursor = 'pointer';
    button.style.fontWeight = '600';
    button.style.fontSize = '14px';
    button.style.transition = 'all 0.2s ease';
    button.style.boxShadow = `0 0 0 1px ${config.color}40`;
    
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#334155';
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = `0 0 0 2px ${config.color}60`;
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#1e293b';
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = `0 0 0 1px ${config.color}40`;
    });
    
    button.addEventListener('click', () => {
      if (threeObjects.current && threeObjects.current.transformControls) {
        // Get the corresponding Three.js axis
        const threeAxis = standardAxis;
        
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
          
          // Reset button styles
          const axisButtons = document.querySelectorAll('#model-control-panel button:not(.transform-button)');
          axisButtons.forEach(btn => {
            if (btn !== button && !btn.id && !btn.classList.contains('transform-button')) {
              btn.style.backgroundColor = '#1e293b';
              btn.style.boxShadow = `0 0 0 1px ${btn.style.color}40`;
            }
          });
        } else {
          // Otherwise, show only this axis
          threeObjects.current.transformControls.showX = (threeAxis === 'x');
          threeObjects.current.transformControls.showY = (threeAxis === 'y');
          threeObjects.current.transformControls.showZ = (threeAxis === 'z');
          
          // Update button styles
          const axisButtons = document.querySelectorAll('#model-control-panel button:not(.transform-button)');
          axisButtons.forEach(btn => {
            if (btn !== button && !btn.id && !btn.classList.contains('transform-button')) {
              btn.style.backgroundColor = '#1e293b';
              btn.style.boxShadow = `0 0 0 1px ${btn.style.color}40`;
            }
          });
          
          // Highlight this button
          button.style.backgroundColor = `${config.color}20`;
          button.style.boxShadow = `0 0 0 2px ${config.color}`;
        }
      } else {
        showTransformError();
      }
    });
    
    return button;
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
              background-color: #2a2a2a;
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
      
      // Clean up resize observer if it exists
      if (threeObjects.current.resizeObserver) {
        threeObjects.current.resizeObserver.disconnect();
        threeObjects.current.resizeObserver = null;
      }
      
      // Remove window resize event listener
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
      
      // Call the global cleanup function
      window.threeJsCleanup(instanceId.current);
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
  
  // Add "Add Another View" button to the control panel
  const addAnotherViewButton = () => {
    console.log('addAnotherViewButton: Starting function');
    
    // Check if we're in a multi-viewer container
    const isInMultiViewer = containerRef.current && 
                           containerRef.current.closest('.multi-viewer-container') !== null;
    
    console.log('addAnotherViewButton: isInMultiViewer =', isInMultiViewer);
    
    // Find the control panel
    const controlPanel = document.getElementById('model-control-panel');
    console.log('addAnotherViewButton: controlPanel =', controlPanel);
    
    if (!controlPanel) {
      console.log('addAnotherViewButton: No control panel found');
      return;
    }
    
    // Check if button already exists
    const existingButton = document.getElementById('add-another-view-button');
    console.log('addAnotherViewButton: existingButton =', existingButton);
    
    if (existingButton) {
      console.log('addAnotherViewButton: Button already exists, skipping creation');
      return;
    }
    
    // Find the panel content
    const panelContent = document.getElementById('panel-content');
    console.log('addAnotherViewButton: panelContent =', panelContent);
    
    if (!panelContent) {
      console.log('addAnotherViewButton: No panel content found');
      return;
    }
    
    // Create the button
    const button = document.createElement('button');
    button.id = 'add-another-view-button';
    button.textContent = 'Add Another View';
    button.style.width = '100%';
    button.style.padding = '10px 12px';
    button.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)';
    button.style.border = 'none';
    button.style.borderRadius = '6px';
    button.style.color = 'white';
    button.style.cursor = 'pointer';
    button.style.marginTop = '16px';
    button.style.fontWeight = '500';
    button.style.fontSize = '14px';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.gap = '8px';
    button.style.boxShadow = '0px 4px 6px rgba(0, 0, 0, 0.1)';
    button.style.transition = '0.3s';
    button.style.transform = 'translateY(0px)';
    
    // Add hover effect
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0px 6px 12px rgba(0, 0, 0, 0.15)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0px)';
      button.style.boxShadow = '0px 4px 6px rgba(0, 0, 0, 0.1)';
    });
    
    // Add plus icon
    const plusIcon = document.createElement('span');
    plusIcon.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    `;
    button.prepend(plusIcon);
    
    // Add click handler
    button.addEventListener('click', () => {
      console.log('Add another view button clicked');
      
      // SIMPLIFIED APPROACH: Just use the global instance directly
      if (window.multiViewerInstance && typeof window.multiViewerInstance.handleAddAnotherView === 'function') {
        console.log('Using global multiViewerInstance.handleAddAnotherView');
        window.multiViewerInstance.handleAddAnotherView({
          detail: { filePath: filePath }
        });
        return;
      }
      
      // Fallback: If no global instance, try to find the container and dispatch event
      const multiViewerContainer = document.querySelector('.multi-viewer-container') || 
                                  document.getElementById('multi-viewer-container');
      
      if (multiViewerContainer) {
        console.log('Found multi-viewer container, dispatching event');
        const event = new CustomEvent('addAnotherView', {
          bubbles: true,
          detail: { filePath: filePath }
        });
        multiViewerContainer.dispatchEvent(event);
      } else {
        // Last resort: Dispatch on document and window
        console.log('No multi-viewer container found, dispatching on document and window');
        
        const event = new CustomEvent('addAnotherView', {
          bubbles: true,
          detail: { filePath: filePath }
        });
        
        document.dispatchEvent(event);
        window.dispatchEvent(event);
      }
    });
    
    // Add the button to the panel
    panelContent.appendChild(button);
    console.log('addAnotherViewButton: Button added to panel');
  };
  
  // Make sure to call addAnotherViewButton after the UI is created
  React.useEffect(() => {
    if (filePath && containerRef.current) {
      // Wait a bit for the UI to be fully created
      setTimeout(() => {
        console.log('Calling addAnotherViewButton after timeout');
        addAnotherViewButton();
      }, 1000);
    }
  }, [filePath]);
  
  // Also add a direct button to the container for better visibility
  React.useEffect(() => {
    if (filePath && containerRef.current) {
      console.log('Setting up floating add view button');
      
      // Check if we're in a multi-viewer container
      const isInMultiViewer = containerRef.current.closest('.multi-viewer-container') !== null;
      console.log('Floating button: isInMultiViewer =', isInMultiViewer);
      
      // Only add the floating button if we're not in a multi-viewer container
      if (isInMultiViewer) {
        console.log('Already in multi-viewer container, skipping floating button');
        return;
      }
      
      // Check if the button already exists
      if (containerRef.current.querySelector('#floating-add-view-button')) {
        console.log('Floating add view button already exists');
        return;
      }
      
      // Create a floating button
      const floatingButton = document.createElement('button');
      floatingButton.id = 'floating-add-view-button';
      floatingButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Add View</span>
      `;
      
      // Style the button
      floatingButton.style.position = 'absolute';
      floatingButton.style.bottom = '20px';
      floatingButton.style.right = '20px';
      floatingButton.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)';
      floatingButton.style.color = 'white';
      floatingButton.style.padding = '10px 16px';
      floatingButton.style.borderRadius = '8px';
      floatingButton.style.border = 'none';
      floatingButton.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
      floatingButton.style.cursor = 'pointer';
      floatingButton.style.display = 'flex';
      floatingButton.style.alignItems = 'center';
      floatingButton.style.gap = '8px';
      floatingButton.style.fontSize = '14px';
      floatingButton.style.fontWeight = '500';
      floatingButton.style.transition = 'all 0.3s ease';
      floatingButton.style.zIndex = '1000';
      
      floatingButton.addEventListener('mouseenter', () => {
        floatingButton.style.transform = 'translateY(-2px)';
        floatingButton.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.5)';
      });
      
      floatingButton.addEventListener('mouseleave', () => {
        floatingButton.style.transform = 'translateY(0)';
        floatingButton.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
      });
      
      floatingButton.addEventListener('click', () => {
        console.log('Floating add view button clicked');
        
        // SIMPLIFIED APPROACH: Just use the global instance directly
        if (window.multiViewerInstance && typeof window.multiViewerInstance.handleAddAnotherView === 'function') {
          console.log('Using global multiViewerInstance.handleAddAnotherView');
          window.multiViewerInstance.handleAddAnotherView({
            detail: { filePath: filePath }
          });
          return;
        }
        
        // Fallback: If no global instance, try to find the container and dispatch event
        const multiViewerContainer = document.querySelector('.multi-viewer-container') || 
                                    document.getElementById('multi-viewer-container');
        
        if (multiViewerContainer) {
          console.log('Found multi-viewer container, dispatching event');
          const event = new CustomEvent('addAnotherView', {
            bubbles: true,
            detail: { filePath: filePath }
          });
          multiViewerContainer.dispatchEvent(event);
        } else {
          // Last resort: Dispatch on document and window
          console.log('No multi-viewer container found, dispatching on document and window');
          
          const event = new CustomEvent('addAnotherView', {
            bubbles: true,
            detail: { filePath: filePath }
          });
          
          document.dispatchEvent(event);
          window.dispatchEvent(event);
        }
      });
      
      // Add the button to the container
      containerRef.current.appendChild(floatingButton);
      console.log('Floating add view button added to container');
    }
  }, [filePath]);
  
  const createToggle = (label, initialState, onChange) => {
    const toggleContainer = document.createElement('div');
    toggleContainer.style.display = 'flex';
    toggleContainer.style.justifyContent = 'space-between';
    toggleContainer.style.alignItems = 'center';
    toggleContainer.style.padding = '8px 0';
    
    const toggleLabel = document.createElement('label');
    toggleLabel.textContent = label;
    toggleLabel.style.flex = '1';
    toggleLabel.style.cursor = 'pointer';
    toggleLabel.style.fontSize = '14px';
    toggleLabel.style.fontWeight = '400';
    
    const toggleSwitch = document.createElement('div');
    toggleSwitch.style.position = 'relative';
    toggleSwitch.style.width = '40px';
    toggleSwitch.style.height = '22px';
    
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
    toggleSlider.style.backgroundColor = initialState ? '#4f46e5' : '#334155';
    toggleSlider.style.borderRadius = '11px';
    toggleSlider.style.transition = 'all 0.3s ease';
    
    const toggleKnob = document.createElement('span');
    toggleKnob.style.position = 'absolute';
    toggleKnob.style.content = '""';
    toggleKnob.style.height = '18px';
    toggleKnob.style.width = '18px';
    toggleKnob.style.left = initialState ? '20px' : '2px';
    toggleKnob.style.bottom = '2px';
    toggleKnob.style.backgroundColor = 'white';
    toggleKnob.style.borderRadius = '50%';
    toggleKnob.style.transition = 'all 0.3s ease';
    toggleKnob.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
    
    // Function to update toggle state
    const updateToggleState = (isChecked) => {
      toggleInput.checked = isChecked;
      toggleSlider.style.backgroundColor = isChecked ? '#4f46e5' : '#334155';
      toggleKnob.style.left = isChecked ? '20px' : '2px';
      
      // Call the onChange handler
      if (typeof onChange === 'function') {
        onChange(isChecked);
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
  
  const showTransformError = () => {
    const controlPanel = document.getElementById('model-control-panel');
    if (!controlPanel) return;
    
    // Create error message
    const errorMessage = document.createElement('div');
    errorMessage.textContent = 'Transform controls not available. Try reloading the model.';
    errorMessage.style.color = '#ef4444';
    errorMessage.style.fontSize = '12px';
    errorMessage.style.padding = '8px 12px';
    errorMessage.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
    errorMessage.style.borderRadius = '6px';
    errorMessage.style.marginTop = '8px';
    errorMessage.style.textAlign = 'center';
    
    // Add to panel
    const panelContent = controlPanel.querySelector('#panel-content');
    if (panelContent) {
      // Check if error message already exists
      const existingError = panelContent.querySelector('.transform-error');
      if (existingError) {
        existingError.remove();
      }
      
      errorMessage.classList.add('transform-error');
      panelContent.appendChild(errorMessage);
      
      // Remove after 3 seconds
      setTimeout(() => {
        if (errorMessage.parentNode === panelContent) {
          panelContent.removeChild(errorMessage);
        }
      }, 3000);
    }
  };
  
  // Return the component JSX
  return React.createElement('div', {
    ref: containerRef,
    className: 'model-viewer-container',
    style: {
      position: 'relative',
      width: '100%',
      height: '100%',
      minHeight: '400px',
      backgroundColor: '#2a2a2a', // Match scene background color
      overflow: 'hidden',
      borderRadius: '8px'
    }
  }, error && React.createElement('div', {
    className: 'error-message',
    style: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      color: '#ff5555',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: '10px 20px',
      borderRadius: '4px',
      zIndex: 100
    }
  }, error));
}; 
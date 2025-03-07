// ModelViewer component v3 - Improved Three.js integration
window.ModelViewer = function ModelViewer({ filePath }) {
  const containerRef = React.useRef(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [modelLoaded, setModelLoaded] = React.useState(false);
  
  // Store Three.js objects in refs to avoid React DOM issues
  const threeObjects = React.useRef({
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    mesh: null,
    animationId: null
  });
  
  console.log('ModelViewer v3: Initializing with file path:', filePath);
  
  // Initialize Three.js scene
  const initThreeJs = React.useCallback(() => {
    if (!containerRef.current) return false;
    
    try {
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
      
      // Add controls
      const controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      
      // Store objects in ref
      threeObjects.current = {
        scene,
        camera,
        renderer,
        controls,
        mesh: null,
        animationId: null
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
      
      return true;
    } catch (err) {
      console.error('Error initializing Three.js:', err);
      setError('Failed to initialize 3D viewer: ' + err.message);
      setLoading(false);
      return false;
    }
  }, []);
  
  // Animation loop
  const animate = React.useCallback(() => {
    const { scene, camera, renderer, controls } = threeObjects.current;
    if (!scene || !camera || !renderer || !controls) return;
    
    threeObjects.current.animationId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }, []);
  
  // Handle window resize
  const handleResize = React.useCallback(() => {
    const { camera, renderer } = threeObjects.current;
    if (!containerRef.current || !camera || !renderer) return;
    
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
  }, []);
  
  // Clean up Three.js resources
  const cleanupThreeJs = React.useCallback(() => {
    console.log('ModelViewer v3: Cleaning up Three.js resources');
    
    const { scene, renderer, controls, mesh, animationId } = threeObjects.current;
    
    // Cancel animation frame
    if (animationId) {
      cancelAnimationFrame(animationId);
      threeObjects.current.animationId = null;
    }
    
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
    
    // Clear container
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
  }, []);
  
  // Load the model
  const loadModel = React.useCallback(async (modelUrl, fileExtension) => {
    const { scene } = threeObjects.current;
    if (!scene) return;
    
    try {
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
              color: 0x00ff00,
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
            const scale = 50 / maxDim;
            mesh.scale.multiplyScalar(scale);
            
            // Add mesh to scene
            scene.add(mesh);
            threeObjects.current.mesh = mesh;
            
            setModelLoaded(true);
            setLoading(false);
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
        
        // Create a placeholder sphere
        const geometry = new THREE.SphereGeometry(25, 32, 32);
        const material = new THREE.MeshPhongMaterial({
          color: 0x00aaff,
          specular: 0x111111,
          shininess: 200
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        threeObjects.current.mesh = mesh;
        
        // Add text to indicate this is a placeholder
        const textDiv = document.createElement('div');
        textDiv.style.position = 'absolute';
        textDiv.style.top = '50%';
        textDiv.style.left = '0';
        textDiv.style.width = '100%';
        textDiv.style.textAlign = 'center';
        textDiv.style.color = 'white';
        textDiv.style.fontSize = '16px';
        textDiv.style.fontWeight = 'bold';
        textDiv.style.textShadow = '0 0 5px black';
        textDiv.style.pointerEvents = 'none';
        textDiv.innerHTML = '3MF Preview<br>(Rotate with mouse)';
        textDiv.id = 'model-text';
        containerRef.current.appendChild(textDiv);
        
        setModelLoaded(true);
        setLoading(false);
      } else {
        throw new Error(`Unsupported file format: ${fileExtension}`);
      }
    } catch (err) {
      console.error('Error in model loading:', err);
      setError(err.message || 'Failed to load model');
      setLoading(false);
    }
  }, []);
  
  // Main effect to set up Three.js and load the model
  React.useEffect(() => {
    if (!containerRef.current) return;
    
    console.log('ModelViewer v3: Loading model from path:', filePath);
    
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
    
    // Start animation loop
    animate();
    
    // Add window resize listener
    window.addEventListener('resize', handleResize);
    
    // Check if file exists and load model
    const checkFileAndLoad = async () => {
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
        
        setError(err.message || 'Failed to load model');
        setLoading(false);
      }
    };
    
    // Start the file check and load process
    checkFileAndLoad();
    
    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      cleanupThreeJs();
    };
  }, [filePath, initThreeJs, animate, handleResize, loadModel, cleanupThreeJs]);
  
  return React.createElement('div', {
    ref: containerRef,
    className: 'w-full h-full min-h-[400px] relative bg-gray-900'
  });
}; 
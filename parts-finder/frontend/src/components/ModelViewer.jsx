window.ModelViewer = function ModelViewer({ filePath }) {
  const containerRef = React.useRef(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!containerRef.current) return;

    let scene, camera, renderer, controls;
    let animationFrameId;
    
    try {
      // Setup scene
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x121212);

      // Setup camera
      camera = new THREE.PerspectiveCamera(
        75,
        containerRef.current.clientWidth / containerRef.current.clientHeight,
        0.1,
        1000
      );
      camera.position.z = 100;

      // Setup renderer
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      );
      containerRef.current.appendChild(renderer.domElement);

      // Add lights
      const ambientLight = new THREE.AmbientLight(0x404040);
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
      directionalLight.position.set(0, 1, 0);
      scene.add(directionalLight);

      // Add controls
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;

      // Animation loop
      function animate() {
        animationFrameId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      }

      // Load the model
      const loader = new THREE.STLLoader();
      loader.load(
        filePath,
        function (geometry) {
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

          scene.add(mesh);
          animate();
          setLoading(false);
        },
        undefined,
        function (error) {
          setError('Error loading model');
          setLoading(false);
        }
      );

      // Cleanup
      return () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        if (controls) {
          controls.dispose();
        }
        if (renderer) {
          renderer.dispose();
        }
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      };
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [filePath]);

  return React.createElement('div', {
    ref: containerRef,
    className: 'w-full h-full min-h-[400px] relative'
  },
    loading && React.createElement('div', {
      className: 'absolute inset-0 flex items-center justify-center bg-gray-900'
    }, 'Loading model...'),
    error && React.createElement('div', {
      className: 'absolute inset-0 flex items-center justify-center bg-gray-900 text-red-500'
    }, error)
  );
}; 
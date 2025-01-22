import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Suspense } from 'react';
import * as THREE from 'three';

function Model() {
  // Create a simple 3D caduceus-like symbol
  return (
    <group position={[0, 0, 0]} rotation={[0, Math.PI / 4, 0]}>
      {/* Staff */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 4, 32]} />
        <meshStandardMaterial color="#4F46E5" />
      </mesh>
      
      {/* Snakes */}
      <group position={[0, 0, 0]}>
        {[1, -1].map((direction, index) => (
          <mesh key={index} position={[0.3 * direction, 0, 0]}>
            <torusGeometry args={[0.5, 0.1, 16, 100, Math.PI * 1.5]} />
            <meshStandardMaterial color="#4F46E5" />
          </mesh>
        ))}
      </group>
      
      {/* Wings */}
      {[-0.5, 0.5].map((x, index) => (
        <mesh key={index} position={[x, 1, 0]} rotation={[0, 0, x < 0 ? -0.5 : 0.5]}>
          <boxGeometry args={[0.8, 0.1, 0.1]} />
          <meshStandardMaterial color="#4F46E5" />
        </mesh>
      ))}
    </group>
  );
}

export function ThreeScene() {
  return (
    <div className="h-[50vh] w-full">
      <Canvas camera={{ position: [0, 0, 5] }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
        <Suspense fallback={null}>
          <Model />
          <OrbitControls enableZoom={false} autoRotate />
        </Suspense>
      </Canvas>
    </div>
  );
}
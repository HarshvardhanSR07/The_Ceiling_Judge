
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface BranchProps {
  start: THREE.Vector3;
  dir: THREE.Vector3;
  length: number;
  width: number;
  depth: number;
  maxDepth: number;
}

function Branch({ start, dir, length, width, depth, maxDepth }: BranchProps) {
  const end = useMemo(() => start.clone().add(dir.clone().multiplyScalar(length)), [start, dir, length]);
  
  const children = useMemo(() => {
    if (depth >= maxDepth) return [];
    
    // Angles for branching
    const angle1 = Math.random() * 0.4 + 0.2;
    const angle2 = -(Math.random() * 0.4 + 0.2);
    const angle3 = Math.random() * Math.PI * 2; 
    
    const dir1 = dir.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), angle1).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle3).normalize();
    const dir2 = dir.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), angle2).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle3 + Math.PI).normalize();
    
    return [
      { dir: dir1, length: length * 0.75, width: width * 0.7 },
      { dir: dir2, length: length * 0.75, width: width * 0.7 }
    ];
  }, [dir, length, width, depth, maxDepth]);

  // Use a glass-like material or glowing white since the user asked to remove blue/purple/violet from background
  // We will make the tree metallic/glassy white/silver.
  const midpoint = start.clone().lerp(end, 0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

  return (
    <group>
      <mesh position={midpoint} quaternion={quaternion}>
        <cylinderGeometry args={[width * 0.7, width, length, 8]} />
        <meshStandardMaterial 
          color="#ffffff" 
          metalness={0.8} 
          roughness={0.2} 
          transparent 
          opacity={0.3 + (depth/maxDepth)*0.5} 
          emissive="#ffffff"
          emissiveIntensity={0.1}
        />
      </mesh>
      {children.map((child, i) => (
        <Branch 
          key={i} 
          start={end} 
          dir={child.dir} 
          length={child.length} 
          width={child.width} 
          depth={depth + 1} 
          maxDepth={maxDepth} 
        />
      ))}
    </group>
  );
}

export function GenerativeTree({ projectCount }: { projectCount: number }) {
  const group = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = state.clock.elapsedTime * 0.1;
      group.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.5 - 3;
    }
  });

  const maxDepth = Math.min(Math.floor(projectCount / 2) + 3, 6);

  return (
    <group ref={group} position={[0, -3, 0]}>
      <pointLight position={[10, 10, 10]} intensity={1} color="#ffffff" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ffffff" />
      <Branch 
        start={new THREE.Vector3(0, 0, 0)} 
        dir={new THREE.Vector3(0, 1, 0)} 
        length={3} 
        width={0.2} 
        depth={0} 
        maxDepth={maxDepth} 
      />
    </group>
  );
}


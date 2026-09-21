import { Canvas, Group, Image, useImage } from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';
import type { Ornament, OverlayPlacement } from '../../types';

type OrnamentOverlayProps = {
  ornament: Ornament;
  placements: OverlayPlacement[];
};

export function OrnamentOverlay({
  ornament,
  placements,
}: OrnamentOverlayProps) {
  const image = useImage(ornament.productImage);

  if (image == null || placements.length === 0) {
    return null;
  }

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {placements.map((placement, index) => {
        const originX = placement.x + placement.width / 2;
        const originY = placement.y;
        return (
          <Group
            key={`${ornament.id}-${index}`}
            transform={[
              { translateX: originX },
              { translateY: originY },
              { rotate: placement.rotation },
              { scaleX: placement.flip ? -1 : 1 },
              { translateX: -placement.width / 2 },
            ]}
          >
            <Image
              image={image}
              x={0}
              y={0}
              width={placement.width}
              height={placement.height}
              fit="contain"
            />
          </Group>
        );
      })}
    </Canvas>
  );
}

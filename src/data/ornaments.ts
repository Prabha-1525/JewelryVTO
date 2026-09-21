import type { ImageSourcePropType } from 'react-native';
import {
  beadedBoxChainImage,
  beadedBoxChainModel,
  bridalChokerImage,
  bridalChokerModel,
  diamondEarringsImage,
  diamondEarringsModel,
  diamondEarringsPreviewModel,
  floralNecklaceImage,
  floralNecklaceModel,
  goldJhumkaImage,
  goldJhumkaModel,
  goldJhumkaPreviewModel,
  goldRopeChainImage,
  goldRopeChainModel,
  layeredCharmSetImage,
  layeredCharmSetModel,
  peacockPendantImage,
  peacockPendantModel,
  pearlJhumkaImage,
  pearlJhumkaModel,
  pearlJhumkaPreviewModel,
  silverStarDropImage,
  silverStarDropModel,
  silverStarDropPreviewModel,
  templeNecklaceImage,
  templeNecklaceModel,
} from '../assets';
import type { Ornament, OrnamentCategory } from '../types';

function createOrnament(
  ornament: Omit<Ornament, 'productImage' | 'glbAsset' | 'previewGlbAsset'> & {
    image: ImageSourcePropType;
    model: number;
    previewModel?: number;
  },
): Ornament {
  const { image, model, previewModel, ...rest } = ornament;
  return {
    ...rest,
    productImage: image,
    glbAsset: model,
    previewGlbAsset: previewModel,
  };
}

export const ornaments: Ornament[] = [
  createOrnament({
    id: 'diamond-earrings',
    name: 'Sapphire Halo Drops',
    category: 'earrings',
    price: 12990,
    description:
      'Two round diamonds above a pear-cut sapphire in a pavé halo. The hook sits on the lobe so the drop hangs below.',
    image: diamondEarringsImage,
    model: diamondEarringsModel,
    previewModel: diamondEarringsPreviewModel,
    scale: 1,
    offset: { x: 0, y: 0 },
    forwardOffset: 0.002,
  }),
  createOrnament({
    id: 'gold-jhumka',
    name: 'Temple Gold Jhumkas',
    category: 'earrings',
    price: 8990,
    description:
      'Hand-carved gold jhumkas with a triple-leaf topper and beaded bell. They follow each ear as you turn.',
    image: goldJhumkaImage,
    model: goldJhumkaModel,
    previewModel: goldJhumkaPreviewModel,
    scale: 1,
    offset: { x: 0, y: 0 },
    forwardOffset: 0.003,
  }),
  createOrnament({
    id: 'pearl-jhumka',
    name: 'Pearl and Emerald Jhumkas',
    category: 'earrings',
    price: 10990,
    description:
      'A green-stone topper over a pavé jhumka and teardrop pearl. Anchored at the piercing so the pearl hangs free.',
    image: pearlJhumkaImage,
    model: pearlJhumkaModel,
    previewModel: pearlJhumkaPreviewModel,
    scale: 1,
    offset: { x: 0, y: 0 },
    forwardOffset: 0.003,
  }),
  createOrnament({
    id: 'silver-star-drop',
    name: 'Silver Star Pearl Drops',
    category: 'earrings',
    price: 4590,
    description:
      'A long silver chain of pearls ending in an open star. A longer silhouette, placed just below the ear anchor.',
    image: silverStarDropImage,
    model: silverStarDropModel,
    previewModel: silverStarDropPreviewModel,
    scale: 1,
    offset: { x: 0, y: 2 },
    forwardOffset: 0.003,
  }),
  createOrnament({
    id: 'gold-rope-chain',
    name: 'Gold Rope Chain',
    category: 'necklaces',
    price: 7490,
    description:
      'A classic twisted rope chain in polished gold. Drapes along the neckline in the live try-on.',
    image: goldRopeChainImage,
    model: goldRopeChainModel,
    scale: 1,
    offset: { x: 0, y: -4 },
    forwardOffset: 0.012,
  }),
  createOrnament({
    id: 'beaded-box-chain',
    name: 'Beaded Box Chain',
    category: 'necklaces',
    price: 5290,
    description:
      'A fine gold box chain with a short run of beads at the front. Best previewed with your collar open.',
    image: beadedBoxChainImage,
    model: beadedBoxChainModel,
    scale: 1,
    offset: { x: 0, y: -4 },
    forwardOffset: 0.012,
  }),
  createOrnament({
    id: 'layered-charm-set',
    name: 'Layered Charm Set',
    category: 'necklaces',
    price: 9890,
    description:
      'Stacked gold chains with a ruby, cherub, lion, and crystal pendant. Face the camera so the layers stay visible.',
    image: layeredCharmSetImage,
    model: layeredCharmSetModel,
    scale: 1,
    offset: { x: 0, y: 0 },
    forwardOffset: 0.014,
  }),
  createOrnament({
    id: 'temple-necklace',
    name: 'Temple Necklace',
    category: 'necklaces',
    price: 12490,
    description:
      'A traditional gold temple necklace with lattice work and enamel drops. Sits across the collarbone.',
    image: templeNecklaceImage,
    model: templeNecklaceModel,
    scale: 1,
    offset: { x: 0, y: 2 },
    forwardOffset: 0.012,
  }),
  createOrnament({
    id: 'peacock-pendant',
    name: 'Peacock Pendant Necklace',
    category: 'necklaces',
    price: 8690,
    description:
      'A gold chain with a circular peacock pendant and ruby drops. Anchored to the lower neck in the preview.',
    image: peacockPendantImage,
    model: peacockPendantModel,
    scale: 1,
    offset: { x: 0, y: 2 },
    forwardOffset: 0.014,
  }),
  createOrnament({
    id: 'floral-necklace',
    name: 'Floral Coin Necklace',
    category: 'necklaces',
    price: 7990,
    description:
      'A gold necklace of fluted floral coins with a matching drop. Follows the neckline as you turn.',
    image: floralNecklaceImage,
    model: floralNecklaceModel,
    scale: 1,
    offset: { x: 0, y: 0 },
    forwardOffset: 0.012,
  }),
  createOrnament({
    id: 'bridal-choker',
    name: 'Bridal Gold Choker',
    category: 'necklaces',
    price: 15990,
    description:
      'A close-fitting bridal choker with dense gold work and a central pendant. Keep your shoulders in frame.',
    image: bridalChokerImage,
    model: bridalChokerModel,
    scale: 1,
    offset: { x: 0, y: 10 },
    forwardOffset: 0.01,
  }),
];

export function getOrnamentById(id: string): Ornament | undefined {
  return ornaments.find(item => item.id === id);
}

export function getOrnamentsByCategory(category: OrnamentCategory): Ornament[] {
  return ornaments.filter(item => item.category === category);
}

function requireOrnament(item: Ornament | undefined): Ornament {
  if (item == null) {
    throw new Error('No ornaments available');
  }
  return item;
}

export function getNextOrnament(currentId: string): Ornament {
  const current = getOrnamentById(currentId);
  const collection = current
    ? getOrnamentsByCategory(current.category)
    : ornaments;
  const index = Math.max(
    0,
    collection.findIndex(item => item.id === currentId),
  );
  return requireOrnament(collection[(index + 1) % collection.length]);
}

export function getPreviousOrnament(currentId: string): Ornament {
  const current = getOrnamentById(currentId);
  const collection = current
    ? getOrnamentsByCategory(current.category)
    : ornaments;
  const index = Math.max(
    0,
    collection.findIndex(item => item.id === currentId),
  );
  return requireOrnament(
    collection[(index - 1 + collection.length) % collection.length],
  );
}

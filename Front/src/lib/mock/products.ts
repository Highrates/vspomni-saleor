export const mockProducts = [
  {
    id: '1',
    title: 'Воспоминание о Париже',
    price: 12990,
    image: '/images/paris.webp',
  },
  {
    id: '2',
    title: 'Теплый ветер Востока',
    price: 10900,
    image: '/images/east.webp',
  },
]

export type productsGrid = productsGridItem[]
export type productGroupItem = 'flower' | 'wood' | 'fresh' | 'sweet'

export interface productsGridItem {
  id: string;
  title: string;
  overview: string
  price: number;
  image: string[];
  thumbnail: string;
  groups: productGroupItem[];
  about: aboutItem;
  capacity: string[];
  notes?: NotePyramid[]
}
export type NotePyramid = {
  basic: string[];
  middle: string[];
  head: string[];
};
interface aboutItem {
  description: string;
  specs: string;
  contain: string;
}
export const mockProductsGrid: productsGrid = [
  {
    id: '1',
    title: 'Кашемир и слива',
    overview: 'Аромат спокойствия, который наполняет дом чувственностью и теплом',
    price: 12890,
    image: ['/images/productGallery.jpg', '/images/productGallery2.jpg', '/images/productGallery3.jpg'],
    thumbnail: '/images/productGallery.jpg',
    groups: ['flower', 'wood', 'sweet'],
    about: {
      description: `"Кашемир и слива". Этот изысканный аромат сочетает в себе мягкие, теплые ноты кашемира 
и сладкие, сочные акценты сливы, создавая атмосферу уюта и спокойствия в вашем доме.

Основные ноты:
- Кашемир: Обволакивающий и теплый, этот аромат дарит ощущение комфорта 
и защищенности, словно вы укутаны в мягкий кашемировый плед.
- Слива: Сладкий и фруктовый, этот компонент добавляет свежести и яркости, наполняя пространство легкой игривостью.`,
      specs: 'lorem',
      contain: 'lorem'
    },
    capacity: ['50', '100', 'sampler'],
    notes: [
      { basic: ['душистый табак'], middle: ['бобы тонка'], head: ['какао', 'ваниль'] }
    ]
  },
  {
    id: '2',
    title: 'Кашемир и слива',
    overview: 'Аромат спокойствия, который наполняет дом чувственностью и теплом',
    price: 12890,
    image: ['/images/productGallery2.jpg', '/images/productGallery.jpg', '/images/productGallery3.jpg'],
    thumbnail: '/images/productGallery.jpg',
    groups: ['flower', 'wood', 'sweet'],
    about: {
      description: `"Кашемир и слива". Этот изысканный аромат сочетает в себе мягкие, теплые ноты кашемира 
и сладкие, сочные акценты сливы...`,
      specs: 'lorem',
      contain: 'lorem'
    },
    capacity: ['50', '100', 'sampler'],
    notes: [
      { basic: ['душистый табак'], middle: ['бобы тонка'], head: ['какао', 'ваниль'] }
    ]
  },
  {
    id: '3',
    title: 'Кашемир и слива',
    overview: 'Аромат спокойствия, который наполняет дом чувственностью и теплом',
    price: 12890,
    image: ['/images/productGallery3.jpg', '/images/productGallery.jpg', '/images/productGallery2.jpg'],
    thumbnail: '/images/productGallery.jpg',
    groups: ['flower', 'wood', 'sweet'],
    about: {
      description: `"Кашемир и слива"...`,
      specs: 'lorem',
      contain: 'lorem'
    },
    capacity: ['50', '100', 'sampler'],
    notes: [
      { basic: ['душистый табак'], middle: ['бобы тонка'], head: ['какао', 'ваниль'] }
    ]
  },
  {
    id: '4',
    title: 'Кашемир и слива',
    overview: 'Аромат спокойствия, который наполняет дом чувственностью и теплом',
    price: 12890,
    image: ['/images/productGallery.jpg', '/images/productGallery2.jpg', '/images/productGallery3.jpg'],
    thumbnail: '/images/productGallery.jpg',
    groups: ['flower', 'wood', 'sweet'],
    about: {
      description: `"Кашемир и слива"...`,
      specs: 'lorem',
      contain: 'lorem'
    },
    capacity: ['50', '100', 'sampler'],
    notes: [
      { basic: ['душистый табак'], middle: ['бобы тонка'], head: ['какао', 'ваниль'] }
    ]
  },
  {
    id: '5',
    title: 'Кашемир и слива',
    overview: 'Аромат спокойствия, который наполняет дом чувственностью и теплом',
    price: 12890,
    image: ['/images/productGallery2.jpg', '/images/productGallery.jpg', '/images/productGallery3.jpg'],
    thumbnail: '/images/productGallery.jpg',
    groups: ['flower', 'wood', 'sweet'],
    about: {
      description: `"Кашемир и слива"...`,
      specs: 'lorem',
      contain: 'lorem'
    },
    capacity: ['50', '100', 'sampler'],
    notes: [
      { basic: ['душистый табак'], middle: ['бобы тонка'], head: ['какао', 'ваниль'] }
    ]
  },
  {
    id: '6',
    title: 'Кашемир и слива',
    overview: 'Аромат спокойствия, который наполняет дом чувственностью и теплом',
    price: 12890,
    image: ['/images/productGallery3.jpg', '/images/productGallery.jpg', '/images/productGallery2.jpg'],
    thumbnail: '/images/productGallery.jpg',
    groups: ['flower', 'wood', 'sweet'],
    about: {
      description: `"Кашемир и слива"...`,
      specs: 'lorem',
      contain: 'lorem'
    },
    capacity: ['50', '100', 'sampler'],
    notes: [
      { basic: ['душистый табак'], middle: ['бобы тонка'], head: ['какао', 'ваниль'] }
    ]
  },
  {
    id: '7',
    title: 'Кашемир и слива',
    overview: 'Аромат спокойствия, который наполняет дом чувственностью и теплом',
    price: 12890,
    image: ['/images/productGallery.jpg', '/images/productGallery2.jpg', '/images/productGallery3.jpg'],
    thumbnail: '/images/productGallery.jpg',
    groups: ['flower', 'wood', 'sweet'],
    about: {
      description: `"Кашемир и слива"...`,
      specs: 'lorem',
      contain: 'lorem'
    },
    capacity: ['50', '100', 'sampler'],
    notes: [
      { basic: ['душистый табак'], middle: ['бобы тонка'], head: ['какао', 'ваниль'] }
    ]
  },
  {
    id: '8',
    title: 'Кашемир и слива',
    overview: 'Аромат спокойствия, который наполняет дом чувственностью и теплом',
    price: 12890,
    image: ['/images/productGallery2.jpg', '/images/productGallery.jpg', '/images/productGallery3.jpg'],
    thumbnail: '/images/productGallery.jpg',
    groups: ['flower', 'wood', 'sweet'],
    about: {
      description: `"Кашемир и слива"...`,
      specs: 'lorem',
      contain: 'lorem'
    },
    capacity: ['50', '100', 'sampler'],
    notes: [
      { basic: ['душистый табак'], middle: ['бобы тонка'], head: ['какао', 'ваниль'] }
    ]
  },
  {
    id: '9',
    title: 'Кашемир и слива',
    overview: 'Аромат спокойствия, который наполняет дом чувственностью и теплом',
    price: 12890,
    image: ['/images/productGallery3.jpg', '/images/productGallery.jpg', '/images/productGallery2.jpg'],
    thumbnail: '/images/productGallery.jpg',
    groups: ['flower', 'wood', 'sweet'],
    about: {
      description: `"Кашемир и слива"...`,
      specs: 'lorem',
      contain: 'lorem'
    },
    capacity: ['50', '100', 'sampler'],
    notes: [
      { basic: ['душистый табак'], middle: ['бобы тонка'], head: ['какао', 'ваниль'] }
    ]
  }
];



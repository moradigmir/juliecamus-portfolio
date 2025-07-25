// Sample project data - in a real implementation, this would be generated from scanning the public/projects folder

export const projects = [
  {
    slug: 'editorial-glamour',
    title: 'Editorial Glamour',
    coverImage: 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=800&h=1000&fit=crop&crop=face',
    images: [
      'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=600&h=800&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1470813740244-df37b8c1edcb?w=600&h=800&fit=crop',
      'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=600&h=800&fit=crop',
      'https://images.unsplash.com/photo-1486718448742-163732cd1544?w=600&h=800&fit=crop',
    ],
    description: 'High-fashion editorial shoot featuring dramatic lighting and bold color choices.',
    year: '2024',
    client: 'Vogue Paris',
    category: 'Editorial'
  },
  {
    slug: 'bridal-elegance',
    title: 'Bridal Elegance',
    coverImage: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=800&h=1200&fit=crop&crop=face',
    images: [
      'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=600&h=900&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=600&h=900&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1470813740244-df37b8c1edcb?w=600&h=900&fit=crop',
    ],
    description: 'Timeless bridal makeup featuring natural glow and subtle enhancement.',
    year: '2024',
    client: 'Private Client',
    category: 'Bridal'
  },
  {
    slug: 'avant-garde-art',
    title: 'Avant-Garde Art',
    coverImage: 'https://images.unsplash.com/photo-1470813740244-df37b8c1edcb?w=800&h=1000&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1470813740244-df37b8c1edcb?w=600&h=800&fit=crop',
      'https://images.unsplash.com/photo-1497604401993-f2e922e5cb0a?w=600&h=800&fit=crop',
      'https://images.unsplash.com/photo-1581090464777-f3220bbe1b8b?w=600&h=800&fit=crop',
      'https://images.unsplash.com/photo-1486718448742-163732cd1544?w=600&h=800&fit=crop',
      'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=600&h=800&fit=crop&crop=face',
    ],
    description: 'Experimental makeup artistry pushing the boundaries of conventional beauty.',
    year: '2024',
    client: 'Art Basel',
    category: 'Art'
  },
  {
    slug: 'fashion-week-paris',
    title: 'Fashion Week Paris',
    coverImage: 'https://images.unsplash.com/photo-1486718448742-163732cd1544?w=800&h=1200&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1486718448742-163732cd1544?w=600&h=900&fit=crop',
      'https://images.unsplash.com/photo-1497604401993-f2e922e5cb0a?w=600&h=900&fit=crop',
      'https://images.unsplash.com/photo-1581090464777-f3220bbe1b8b?w=600&h=900&fit=crop',
    ],
    description: 'Backstage makeup artistry for Paris Fashion Week runway shows.',
    year: '2024',
    client: 'Various Designers',
    category: 'Fashion'
  },
  {
    slug: 'celebrity-portraits',
    title: 'Celebrity Portraits',
    coverImage: 'https://images.unsplash.com/photo-1497604401993-f2e922e5cb0a?w=800&h=1000&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1497604401993-f2e922e5cb0a?w=600&h=800&fit=crop',
      'https://images.unsplash.com/photo-1581090464777-f3220bbe1b8b?w=600&h=800&fit=crop',
      'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=600&h=800&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=600&h=800&fit=crop&crop=face',
    ],
    description: 'Red carpet and editorial makeup for high-profile celebrities.',
    year: '2023',
    client: 'Confidential',
    category: 'Celebrity'
  },
  {
    slug: 'commercial-beauty',
    title: 'Commercial Beauty',
    coverImage: 'https://images.unsplash.com/photo-1581090464777-f3220bbe1b8b?w=800&h=1000&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1581090464777-f3220bbe1b8b?w=600&h=800&fit=crop',
      'https://images.unsplash.com/photo-1486718448742-163732cd1544?w=600&h=800&fit=crop',
      'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=600&h=800&fit=crop&crop=face',
    ],
    description: 'Clean, commercial makeup looks for beauty campaigns and advertisements.',
    year: '2023',
    client: 'L\'Oréal',
    category: 'Commercial'
  }
];

export const getProjectBySlug = (slug: string) => {
  return projects.find(project => project.slug === slug);
};
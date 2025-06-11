import { GetStaticProps } from 'next';
import { useState } from 'react';

interface HomeProps {
  posts: Array<{
    id: number;
    title: string;
    excerpt: string;
    author: string;
    publishedAt: string;
    category: string;
  }>;
}

export default function Home({ posts }: HomeProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const categories = ['all', 'technology', 'design', 'business'];
  
  const filteredPosts = posts.filter(post => {
    const matchesCategory = selectedCategory === 'all' || post.category === selectedCategory;
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.excerpt.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-8 md:p-12">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Welcome to Our Blog
          </h1>
          <p className="text-xl md:text-2xl text-blue-100 mb-8">
            Discover insights, tutorials, and stories from our team
          </p>
          <button className="bg-white text-blue-600 font-semibold py-3 px-6 rounded-lg hover:bg-gray-100 transition-colors duration-200">
            Get Started
          </button>
        </div>
      </section>

      {/* Filters */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                  selectedCategory === category
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
          <div className="w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search posts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </section>

      {/* Posts Grid */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map(post => (
            <article
              key={post.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    post.category === 'technology' ? 'bg-blue-100 text-blue-800' :
                    post.category === 'design' ? 'bg-purple-100 text-purple-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {post.category}
                  </span>
                  <time className="text-sm text-gray-500">{post.publishedAt}</time>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-3 line-clamp-2">
                  {post.title}
                </h2>
                <p className="text-gray-600 mb-4 line-clamp-3">
                  {post.excerpt}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                      {post.author.charAt(0)}
                    </div>
                    <span className="text-sm text-gray-700">{post.author}</span>
                  </div>
                  <button className="text-blue-500 hover:text-blue-700 text-sm font-medium">
                    Read More →
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        
        {filteredPosts.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📝</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No posts found</h3>
            <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  // Simulate fetching posts
  const posts = [
    {
      id: 1,
      title: "Getting Started with Next.js and Tailwind CSS",
      excerpt: "Learn how to set up a modern web application with Next.js and Tailwind CSS for rapid development and beautiful styling.",
      author: "John Doe",
      publishedAt: "2024-01-15",
      category: "technology"
    },
    {
      id: 2,
      title: "Design System Best Practices",
      excerpt: "Discover how to build and maintain a scalable design system that keeps your team aligned and your users happy.",
      author: "Jane Smith",
      publishedAt: "2024-01-12",
      category: "design"
    },
    {
      id: 3,
      title: "Building a Scalable Business",
      excerpt: "Key strategies and lessons learned from scaling a startup from idea to product-market fit and beyond.",
      author: "Mike Johnson",
      publishedAt: "2024-01-10",
      category: "business"
    },
    {
      id: 4,
      title: "Advanced React Patterns",
      excerpt: "Explore advanced React patterns and techniques that will make your applications more maintainable and performant.",
      author: "Sarah Wilson",
      publishedAt: "2024-01-08",
      category: "technology"
    },
    {
      id: 5,
      title: "User Experience Design Principles",
      excerpt: "Core principles of UX design that every designer and developer should understand to create better user experiences.",
      author: "Alex Chen",
      publishedAt: "2024-01-05",
      category: "design"
    },
    {
      id: 6,
      title: "Startup Funding Strategies",
      excerpt: "A comprehensive guide to different funding options available for startups and when to pursue each one.",
      author: "Emma Davis",
      publishedAt: "2024-01-03",
      category: "business"
    }
  ];

  return {
    props: {
      posts
    },
    revalidate: 60 // Revalidate every minute
  };
}; 
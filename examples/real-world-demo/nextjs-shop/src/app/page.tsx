'use client';

import {
  BellIcon,
  FunnelIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  ShoppingCartIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon, StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { useEffect, useState } from 'react';

// shadcn/ui components
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Demo product data with more complexity
const featuredProducts = [
  {
    id: 1,
    name: 'Premium Wireless Headphones',
    price: 299.99,
    originalPrice: 399.99,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
    rating: 4.8,
    reviews: 124,
    category: 'Electronics',
    inStock: true,
    badge: 'Best Seller',
    description:
      'High-quality wireless headphones with noise cancellation and 30-hour battery life',
    features: ['Active Noise Cancellation', 'Bluetooth 5.0', '30hr Battery', 'Quick Charge'],
    colors: ['Black', 'White', 'Silver'],
    sizes: ['One Size'],
  },
  {
    id: 2,
    name: 'Smart Fitness Watch',
    price: 199.99,
    originalPrice: null,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
    rating: 4.6,
    reviews: 89,
    category: 'Wearables',
    inStock: true,
    badge: 'New',
    description:
      'Track your fitness goals with this advanced smartwatch featuring GPS and heart rate monitoring',
    features: ['GPS Tracking', 'Heart Rate Monitor', 'Water Resistant', 'Sleep Tracking'],
    colors: ['Black', 'Rose Gold', 'Silver'],
    sizes: ['38mm', '42mm'],
  },
  {
    id: 3,
    name: 'Minimalist Desk Lamp',
    price: 79.99,
    originalPrice: 99.99,
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    rating: 4.9,
    reviews: 56,
    category: 'Home & Office',
    inStock: false,
    badge: 'Limited Edition',
    description: 'Modern LED desk lamp with adjustable brightness and wireless charging base',
    features: ['LED Technology', 'Wireless Charging', 'Touch Controls', 'USB-C'],
    colors: ['White', 'Black', 'Wood'],
    sizes: ['Standard'],
  },
  {
    id: 4,
    name: 'Organic Cotton T-Shirt',
    price: 29.99,
    originalPrice: null,
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop',
    rating: 4.7,
    reviews: 203,
    category: 'Clothing',
    inStock: true,
    badge: 'Eco-Friendly',
    description: 'Comfortable organic cotton t-shirt with sustainable production and perfect fit',
    features: ['100% Organic Cotton', 'Fair Trade', 'Machine Washable', 'Pre-Shrunk'],
    colors: ['White', 'Black', 'Gray', 'Navy', 'Forest Green'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  },
  {
    id: 5,
    name: 'Professional Camera Lens',
    price: 899.99,
    originalPrice: 1199.99,
    image: 'https://images.unsplash.com/photo-1606983340126-99ab4feaa64d?w=400&h=400&fit=crop',
    rating: 4.9,
    reviews: 67,
    category: 'Photography',
    inStock: true,
    badge: 'Pro Choice',
    description:
      'Professional-grade camera lens with exceptional image quality and weather sealing',
    features: ['Weather Sealed', 'Image Stabilization', 'Fast Autofocus', 'Full Frame'],
    colors: ['Black'],
    sizes: ['85mm f/1.4'],
  },
  {
    id: 6,
    name: 'Ergonomic Office Chair',
    price: 449.99,
    originalPrice: 599.99,
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=400&fit=crop',
    rating: 4.5,
    reviews: 156,
    category: 'Furniture',
    inStock: true,
    badge: "Editor's Pick",
    description: 'Premium ergonomic office chair with lumbar support and breathable mesh design',
    features: ['Lumbar Support', 'Breathable Mesh', 'Height Adjustable', '5-Year Warranty'],
    colors: ['Black', 'Gray', 'White'],
    sizes: ['Standard', 'Tall'],
  },
];

const testimonials = [
  {
    id: 1,
    name: 'Sarah Johnson',
    role: 'Product Manager',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop',
    content: 'Amazing experience! The quality is outstanding and shipping was incredibly fast.',
    rating: 5,
    verified: true,
  },
  {
    id: 2,
    name: 'Michael Chen',
    role: 'Designer',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
    content: 'Perfect for my home office setup. The design is minimal and functional.',
    rating: 5,
    verified: true,
  },
  {
    id: 3,
    name: 'Emily Rodriguez',
    role: 'Developer',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
    content: 'Great customer service and the product exceeded my expectations!',
    rating: 4,
    verified: false,
  },
];

export default function HomePage() {
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [cart, setCart] = useState<number[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Demo sensitive data that Scramble will protect
  const [sensitiveData, setSensitiveData] = useState({
    userEmail: 'john.doe@example.com',
    lastPurchase: '$1,247.99',
    memberSince: '2019',
    creditCard: '•••• •••• •••• 1234',
    phoneNumber: '+1 (555) 123-4567',
    address: '123 Main St, San Francisco, CA',
  });

  // Simulate loading progress
  useEffect(() => {
    const timer = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + Math.random() * 10;
      });
    }, 200);

    return () => clearInterval(timer);
  }, []);

  const toggleFavorite = (productId: number) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(productId)) {
        newFavorites.delete(productId);
      } else {
        newFavorites.add(productId);
      }
      return newFavorites;
    });
  };

  const addToCart = (productId: number) => {
    setCart((prev) => [...prev, productId]);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Newsletter signup:', userEmail);
    setUserEmail('');
    alert('Thanks for subscribing! (Demo only)');
  };

  const filteredProducts = featuredProducts.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' ||
      product.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...Array.from(new Set(featuredProducts.map((p) => p.category)))];

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Enhanced Header with shadcn components */}
      <header className="sticky top-0 z-50 w-full border-b border-gray-200/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                TW-Enigma Demo
              </h1>
              <Badge variant="default" className="hidden sm:inline-flex">
                v1.0.3
              </Badge>
              <Badge variant="secondary" className="hidden md:inline-flex">
                Scramble Protected
              </Badge>
            </div>

            {/* Search Bar */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  type="search"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" className="relative">
                <BellIcon className="w-5 h-5" />
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs"
                >
                  3
                </Badge>
              </Button>

              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCartIcon className="w-5 h-5" />
                {cart.length > 0 && (
                  <Badge
                    variant="default"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs"
                  >
                    {cart.length}
                  </Badge>
                )}
              </Button>

              <Avatar className="h-8 w-8">
                <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop" />
                <AvatarFallback>
                  <UserIcon className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>

              <Button variant="default" size="sm" className="hidden sm:inline-flex">
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Success Message */}
      {showSuccessMessage && (
        <div className="fixed top-20 right-4 z-50">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-green-800 font-medium">Added to cart!</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Hero Section with Progress */}
      <section className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              Experience{' '}
              <span className="bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
                TW-Enigma
              </span>{' '}
              +{' '}
              <span className="bg-gradient-to-r from-green-600 via-green-500 to-green-600 bg-clip-text text-transparent">
                Scramble
              </span>
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
              This demo showcases real-world CSS optimization with TW-Enigma and privacy protection
              with Scramble. Open your browser's developer tools to see the optimized class names!
            </p>
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Demo Loading Progress</span>
              <span>{Math.round(loadingProgress)}%</span>
            </div>
            <Progress value={loadingProgress} className="w-full" />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8">
              Browse Products
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8">
              View Demo Features
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section with Cards */}
      <section className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="space-y-2">
              <div className="text-4xl font-bold text-primary">60%</div>
              <p className="text-muted-foreground">CSS Bundle Size Reduction</p>
              <Progress value={60} className="w-full" />
            </CardContent>
          </Card>

          <Card className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="space-y-2">
              <div className="text-4xl font-bold text-green-600">95%</div>
              <p className="text-muted-foreground">Data Protection Coverage</p>
              <Progress value={95} className="w-full" />
            </CardContent>
          </Card>

          <Card className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="space-y-2">
              <div className="text-4xl font-bold text-blue-600">0.2s</div>
              <p className="text-muted-foreground">Faster Page Load Time</p>
              <div className="flex justify-center">
                <Badge variant="secondary">Measured</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Privacy Protection Demo with Tabs */}
      <section className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center space-y-4 mb-12">
          <h3 className="text-3xl font-bold">Privacy Protection Demo</h3>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            See how Scramble protects sensitive data and form inputs in real-time
          </p>
        </div>

        <Tabs defaultValue="user-data" className="max-w-4xl mx-auto">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="user-data">User Data</TabsTrigger>
            <TabsTrigger value="forms">Forms</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="user-data" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <span>User Profile</span>
                    <Badge variant="secondary">🔒 Protected</Badge>
                  </CardTitle>
                  <CardDescription>
                    Scramble automatically protects sensitive personal data
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Email</p>
                      <p className="sensitive-data user-email" data-sensitive="email">
                        {sensitiveData.userEmail}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Phone</p>
                      <p className="sensitive-data phone-number" data-sensitive="phone">
                        {sensitiveData.phoneNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Last Purchase</p>
                      <p className="sensitive-data" data-sensitive="financial">
                        {sensitiveData.lastPurchase}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Payment Method</p>
                      <p className="sensitive-data credit-card-number" data-sensitive="payment">
                        {sensitiveData.creditCard}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Address</p>
                    <p className="sensitive-data" data-sensitive="address">
                      {sensitiveData.address}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Protection Status</CardTitle>
                  <CardDescription>Real-time privacy protection metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Protected Elements</span>
                      <Badge variant="outline">6 active</Badge>
                    </div>
                    <Progress value={100} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Idle Detection</span>
                      <Badge variant="outline">5s timeout</Badge>
                    </div>
                    <Progress value={75} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Scramble Intensity</span>
                      <Badge variant="outline">Enhanced</Badge>
                    </div>
                    <Progress value={90} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="forms" className="space-y-6">
            <Card className="max-w-md mx-auto">
              <CardHeader>
                <CardTitle>Newsletter Signup</CardTitle>
                <CardDescription>Form data is automatically protected by Scramble</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      Email Address
                    </label>
                    <Input
                      type="email"
                      id="email"
                      name="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="form-sensitive"
                      data-scramble-field="email"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Subscribe to Newsletter
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Page Analytics</CardTitle>
                  <CardDescription>Protected user behavior data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Session Duration</span>
                      <span className="text-sm font-medium">2m 34s</span>
                    </div>
                    <Progress value={67} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Pages Viewed</span>
                      <span className="text-sm font-medium">3 pages</span>
                    </div>
                    <Progress value={30} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Engagement Score</span>
                      <span className="text-sm font-medium">High</span>
                    </div>
                    <Progress value={85} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Privacy Compliance</CardTitle>
                  <CardDescription>GDPR and privacy regulation status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Data Minimization</span>
                    <Badge variant="default">✓ Compliant</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">User Consent</span>
                    <Badge variant="default">✓ Obtained</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Right to be Forgotten</span>
                    <Badge variant="default">✓ Supported</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Data Portability</span>
                    <Badge variant="default">✓ Available</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* Product Filters */}
      <section className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <FunnelIcon className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">Filter by category:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="capitalize"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced Product Grid */}
      <section className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center space-y-4 mb-12">
          <h3 className="text-3xl font-bold">Featured Products</h3>
          <p className="text-muted-foreground">
            Showing {filteredProducts.length} of {featuredProducts.length} products
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className="group overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={product.image}
                  alt={product.name}
                  className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                />
                {!product.inStock && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Badge variant="destructive">Out of Stock</Badge>
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <Badge variant="secondary">{product.badge}</Badge>
                </div>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => toggleFavorite(product.id)}
                >
                  {favorites.has(product.id) ? (
                    <HeartSolidIcon className="w-4 h-4 text-red-500" />
                  ) : (
                    <HeartIcon className="w-4 h-4" />
                  )}
                </Button>
              </div>

              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center space-x-1 mb-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <StarSolidIcon
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.floor(product.rating) ? 'text-yellow-400' : 'text-gray-300'
                        }`}
                      />
                    ))}
                    <span className="text-sm text-muted-foreground ml-2">({product.reviews})</span>
                  </div>

                  <h4 className="font-semibold text-lg group-hover:text-primary transition-colors">
                    {product.name}
                  </h4>

                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {product.description}
                  </p>

                  <div className="flex flex-wrap gap-1">
                    {product.features.slice(0, 2).map((feature) => (
                      <Badge key={feature} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                    {product.features.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{product.features.length - 2} more
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="p-6 pt-0 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl font-bold text-primary">${product.price}</span>
                    {product.originalPrice && (
                      <span className="text-sm text-muted-foreground line-through">
                        ${product.originalPrice}
                      </span>
                    )}
                  </div>
                  {product.originalPrice && (
                    <Badge variant="destructive" className="text-xs">
                      Save ${(product.originalPrice - product.price).toFixed(2)}
                    </Badge>
                  )}
                </div>

                <Button
                  onClick={() => addToCart(product.id)}
                  disabled={!product.inStock}
                  className="shrink-0"
                >
                  {product.inStock ? 'Add to Cart' : 'Sold Out'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      {/* Customer Testimonials */}
      <section className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 bg-muted/30">
        <div className="text-center space-y-4 mb-12">
          <h3 className="text-3xl font-bold">What Our Customers Say</h3>
          <p className="text-muted-foreground">Real feedback from verified customers</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.id} className="p-6">
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <StarSolidIcon
                      key={i}
                      className={`w-4 h-4 ${
                        i < testimonial.rating ? 'text-yellow-400' : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>

                <p className="text-muted-foreground italic">"{testimonial.content}"</p>

                <div className="flex items-center space-x-3">
                  <Avatar>
                    <AvatarImage src={testimonial.avatar} />
                    <AvatarFallback>
                      {testimonial.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="font-medium">{testimonial.name}</p>
                      {testimonial.verified && (
                        <Badge variant="secondary" className="text-xs">
                          ✓ Verified
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Technical Demo Section */}
      <section className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <Card className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
          <CardContent className="p-12">
            <div className="text-center space-y-4 mb-12">
              <h3 className="text-3xl font-bold">Technical Implementation</h3>
              <p className="text-gray-300 max-w-2xl mx-auto">
                See the technical details of how TW-Enigma and Scramble work together
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-6">
                <h4 className="text-xl font-semibold text-blue-300">TW-Enigma Optimization</h4>
                <div className="space-y-4">
                  {[
                    'Class names obfuscated with --length=5 setting',
                    'CSS bundle size reduced by removing unused styles',
                    'Build-time optimization with --prettier formatting',
                    'Source maps maintained for development debugging',
                    'Automatic Tailwind utility class compression',
                  ].map((feature, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 shrink-0"></div>
                      <span className="text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-xl font-semibold text-green-300">
                  Scramble Privacy Protection
                </h4>
                <div className="space-y-4">
                  {[
                    'Real-time sensitive data protection with visual indicators',
                    'Form fields protected from automated inspection',
                    'Idle detection with automatic data scrambling',
                    'GDPR compliance with right-to-be-forgotten support',
                    'Bot protection and scraping prevention mechanisms',
                  ].map((feature, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="w-2 h-2 rounded-full bg-green-400 mt-2 shrink-0"></div>
                      <span className="text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-12 text-center">
              <div className="inline-flex items-center space-x-4 p-4 bg-white/10 rounded-lg">
                <Badge variant="outline" className="text-white border-white/30">
                  shadcn/ui Components
                </Badge>
                <Badge variant="outline" className="text-white border-white/30">
                  Extensive CSS Classes
                </Badge>
                <Badge variant="outline" className="text-white border-white/30">
                  Real Scramble Integration
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-muted/30">
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              This is a comprehensive demonstration of TW-Enigma CSS optimization and Scramble
              privacy protection.
            </p>
            <div className="flex justify-center space-x-4">
              <Badge variant="outline">Length: 5 characters</Badge>
              <Badge variant="outline">Prettier: Enabled</Badge>
              <Badge variant="outline">Scramble: Active</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Check your browser's developer tools to see the optimized class names in action!
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

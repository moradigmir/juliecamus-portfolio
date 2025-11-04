import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navigation = [
    { name: 'Portfolio', href: '/' },
    { name: 'About', href: '/about' },
    { name: 'Contact', href: '/contact' },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex justify-between items-center h-24 md:h-28">
          
          {/* LEFT: Brand & Navigation */}
          <div className="flex flex-col justify-center">
            {/* Logo */}
            <Link 
              to="/" 
              className="font-playfair text-3xl md:text-5xl lg:text-6xl font-bold text-black"
            >
              JULIE CAMUS
            </Link>
            
            {/* Tagline */}
            <p className="font-inter text-xs md:text-sm text-gray-600 mt-1">
              french high end makeup artist
            </p>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex space-x-6 md:space-x-8 mt-3 md:mt-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`font-inter text-sm transition-colors ${
                    isActive(item.href)
                      ? 'font-medium text-black'
                      : 'text-gray-600 hover:text-black'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          {/* RIGHT: Featured Work Image */}
          <div className="hidden md:block">
            <img 
              src="/placeholder.svg" 
              alt="Latest work" 
              className="h-24 md:h-28 w-auto object-cover rounded-sm"
            />
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-black hover:text-gray-600 transition-colors"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-200"
          >
            <div className="px-6 py-3 space-y-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`block py-2 font-inter text-sm transition-colors ${
                    isActive(item.href)
                      ? 'font-medium text-black'
                      : 'text-gray-600 hover:text-black'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navigation;
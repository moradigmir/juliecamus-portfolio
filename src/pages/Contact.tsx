import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Instagram } from "lucide-react";
import Navigation from "../components/Navigation";

const Contact = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h1 className="font-playfair text-4xl md:text-5xl font-bold text-foreground mb-6">Get In Touch</h1>
            <p className="font-inter text-xl text-muted-foreground max-w-2xl mx-auto">
              Ready to create something beautiful together? Please reach out via email or Instagram.
            </p>
          </motion.div>

          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="space-y-8"
          >
            <div>
              <h2 className="font-playfair text-3xl font-semibold text-foreground mb-8 text-center">Contact Information</h2>

              <div className="grid sm:grid-cols-2 gap-6 mb-8">
                <a 
                  href="mailto:hello@juliecamus.com"
                  className="flex items-center space-x-4 p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-all duration-200 hover:scale-105"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-inter font-medium text-foreground">Email</p>
                    <p className="font-inter text-sm text-muted-foreground">hello@juliecamus.com</p>
                  </div>
                </a>

                <a 
                  href="tel:+33612443319"
                  className="flex items-center space-x-4 p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-all duration-200 hover:scale-105"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Phone className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-inter font-medium text-foreground">Phone</p>
                    <p className="font-inter text-sm text-muted-foreground">+33 6 12 44 33 19</p>
                  </div>
                </a>

                <div className="flex items-center space-x-4 p-4 bg-muted/30 rounded-lg">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-inter font-medium text-foreground">Location</p>
                    <p className="font-inter text-sm text-muted-foreground">Paris, France</p>
                  </div>
                </div>

                <a 
                  href="https://instagram.com/juliecamusmakeup"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-4 p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-all duration-200 hover:scale-105"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Instagram className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-inter font-medium text-foreground">Instagram</p>
                    <p className="font-inter text-sm text-muted-foreground">@juliecamusmakeup</p>
                  </div>
                </a>
              </div>
            </div>

            <div className="bg-muted/50 border-2 border-border rounded-lg p-6 shadow-sm">
              <h3 className="font-playfair text-xl font-semibold text-foreground mb-4">Services</h3>
              <ul className="font-inter text-foreground/80 space-y-2">
                <li>• Editorial & Fashion Photography</li>
                <li>• Runway & Fashion Week</li>
                <li>• Celebrity & Red Carpet</li>
                <li>• Special Events</li>
                <li>• Commercial & Advertising</li>
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Contact;

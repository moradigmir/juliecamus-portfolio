import { motion } from 'framer-motion';
import Navigation from '../components/Navigation';

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="grid lg:grid-cols-2 gap-12 items-center"
          >
            {/* Portrait */}
            <div className="order-2 lg:order-1">
              <div className="aspect-[3/4] rounded-lg overflow-hidden bg-muted">
                <img
                  src="https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=600&h=800&fit=crop&crop=face"
                  alt="Julie Camus Portrait"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Bio */}
            <div className="order-1 lg:order-2">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.8 }}
              >
                <h1 className="font-playfair text-4xl md:text-5xl font-bold text-foreground mb-6">
                  About Julie
                </h1>
                
                <div className="space-y-6 font-inter text-lg text-muted-foreground leading-relaxed">
                  <p>
                    With over a decade of experience in the luxury beauty industry, Julie Camus has established herself as one of France's most sought-after makeup artists. Her work spans editorial photography, high fashion runway shows, and celebrity red carpet events.
                  </p>
                  
                  <p>
                    Born and raised in Paris, Julie discovered her passion for makeup artistry at the prestigious École de Maquillage Artistique. Her unique approach combines classical French elegance with contemporary artistic vision, creating looks that are both timeless and cutting-edge.
                  </p>
                  
                  <p>
                    Julie's work has been featured in Vogue Paris, Harper's Bazaar, and Elle Magazine. She has collaborated with renowned photographers and fashion designers across Paris, Milan, and New York Fashion Weeks.
                  </p>
                  
                  <p>
                    When not working on set, Julie teaches masterclasses at the Académie de Beauté in Paris and mentors emerging makeup artists in the industry.
                  </p>
                </div>

                {/* Achievements */}
                <div className="mt-12">
                  <h2 className="font-playfair text-2xl font-semibold text-foreground mb-6">
                    Recognition
                  </h2>
                  <div className="space-y-3 font-inter text-muted-foreground">
                    <div className="flex justify-between items-center border-b border-border pb-2">
                      <span>Prix de la Beauté Française</span>
                      <span className="text-primary">2023</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-border pb-2">
                      <span>Fashion Week Best Makeup Artist</span>
                      <span className="text-primary">2022</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-border pb-2">
                      <span>Vogue Beauty Award</span>
                      <span className="text-primary">2021</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default About;
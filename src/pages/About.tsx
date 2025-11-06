import { motion } from "framer-motion";
import Navigation from "../components/Navigation";
const About = () => {
  const base = import.meta.env.BASE_URL || "/";
  const logos = [
    { src: `${base}logos/dior.png`, alt: "Dior" },
    { src: `${base}logos/givenchy.png`, alt: "Givenchy" },
    { src: `${base}logos/armani-beauty.png`, alt: "Armani Beauty" },
    { src: `${base}logos/carolina-herrera.png`, alt: "Carolina Herrera" },
    { src: `${base}logos/numero.png`, alt: "Numéro" },
    { src: `${base}logos/harpers-bazaar.png`, alt: "Harper's Bazaar" },
  ];
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Quick visible client logos strip */}
          <div className="mt-2 mb-8">
            <h3 className="font-playfair text-xl font-semibold text-foreground mb-4">Clients include:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { src: '/logos/dior.png', alt: 'Dior' },
                { src: '/logos/givenchy.png', alt: 'Givenchy' },
                { src: '/logos/armani-beauty.png', alt: 'Armani Beauty' },
                { src: '/logos/carolina-herrera.png', alt: 'Carolina Herrera' },
                { src: '/logos/numero.png', alt: 'Numéro' },
                { src: '/logos/harpers-bazaar.png', alt: "Harper's Bazaar" },
              ].map((logo) => (
                <div key={logo.alt} className="relative aspect-video bg-muted/30 rounded-lg p-6 flex items-center justify-center overflow-hidden border border-border/50">
                  <img src={logo.src} alt={logo.alt} className="w-full h-full object-contain grayscale opacity-60 transition-all duration-300" loading="eager" />
                </div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.8,
            }}
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
                initial={{
                  opacity: 0,
                  x: 20,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                transition={{
                  delay: 0.2,
                  duration: 0.8,
                }}
              >
                <h1 className="font-playfair text-4xl md:text-5xl font-bold text-foreground mb-6">About Julie</h1>

                <div className="space-y-6 font-inter text-lg text-muted-foreground leading-relaxed">
                  <p>
                    With over 20 years of experience in fashion and beauty, Julie is a highly skilled makeup artist
                    renowned for her refined technique and meticulous attention to detail. Her signature style blends
                    flawless, imperceptible natural looks with a sophisticated creative vision.
                  </p>

                  <p>
                    Trusted by some of the most prestigious luxury brands, she has consistently delivered impeccable
                    results for the most demanding clients. Throughout her career, she has worked alongside celebrated
                    industry figures such as Lucia Pica, former Global Creative Director for Chanel, and Peter Philips,
                    Creative and Image Director of Dior Makeup, with whom she has collaborated for over 15 years.
                  </p>

                  <div className="mt-8">
                    <h3 className="font-playfair text-xl font-semibold text-foreground mb-6">Clients include:</h3>
                    <motion.div 
                      className="grid grid-cols-2 md:grid-cols-3 gap-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.8, delay: 0.4 }}
                    >
                      {[
                        { src: '/logos/dior.png', alt: 'Dior' },
                        { src: '/logos/givenchy.png', alt: 'Givenchy' },
                        { src: '/logos/armani-beauty.png', alt: 'Armani Beauty' },
                        { src: '/logos/carolina-herrera.png', alt: 'Carolina Herrera' },
                        { src: '/logos/numero.png', alt: 'Numéro' },
                        { src: '/logos/harpers-bazaar.png', alt: "Harper's Bazaar" },
                      ].map((logo, index) => (
                        <motion.div
                          key={logo.alt}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                          className="group relative aspect-video bg-muted/30 rounded-lg p-6 flex items-center justify-center overflow-hidden border border-border/50 hover:border-border transition-all duration-300"
                        >
                          <img
                            src={logo.src}
                            alt={logo.alt}
                            className="w-full h-full object-contain grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
                            loading="lazy"
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>
                </div>

                {/* Achievements */}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
export default About;

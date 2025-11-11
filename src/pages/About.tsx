import { motion } from "framer-motion";
import Navigation from "../components/Navigation";
import juliePortfolio from "@/assets/julie-portfolio-preview.png";
const About = () => {
  const base = import.meta.env.BASE_URL || "/";
  // Generate logos array for all 57 processed logos
  const logos = Array.from({ length: 57 }, (_, i) => ({
    src: `${base}logos/logo-${String(i + 1).padStart(3, '0')}.png`,
    alt: `Client ${i + 1}`
  }));
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
            {/* Portfolio Preview */}
            <div className="order-2 lg:order-1">
              <div className="rounded-lg overflow-hidden bg-muted shadow-lg">
                <img
                  src={juliePortfolio}
                  alt="Julie Camus Portfolio"
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
                </div>

                {/* Achievements */}
              </motion.div>
            </div>
          </motion.div>

          {/* Client logos */}
          <div className="mt-16">
            <h3 className="font-playfair text-xl font-semibold text-foreground mb-6">Clients include:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {logos.map((logo) => (
                <div key={logo.alt} className="relative aspect-video bg-muted/30 rounded-lg p-6 flex items-center justify-center overflow-hidden border border-border/50">
                  <img src={logo.src} alt={logo.alt} className="w-full h-full object-contain grayscale opacity-60 transition-all duration-300" loading="eager" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default About;

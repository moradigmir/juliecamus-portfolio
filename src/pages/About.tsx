import { motion } from 'framer-motion';
import Navigation from '../components/Navigation';
const About = () => {
  return <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.8
        }} className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Portrait */}
            <div className="order-2 lg:order-1">
              <div className="aspect-[3/4] rounded-lg overflow-hidden bg-muted">
                <img src="https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=600&h=800&fit=crop&crop=face" alt="Julie Camus Portrait" className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Bio */}
            <div className="order-1 lg:order-2">
              <motion.div initial={{
              opacity: 0,
              x: 20
            }} animate={{
              opacity: 1,
              x: 0
            }} transition={{
              delay: 0.2,
              duration: 0.8
            }}>
                <h1 className="font-playfair text-4xl md:text-5xl font-bold text-foreground mb-6">
                  About Julie
                </h1>
                
                <div className="space-y-6 font-inter text-lg text-muted-foreground leading-relaxed">
                  <p>
                    With over 20 years of experience in fashion and beauty, JULIE is a highly skilled makeup artist renowned for her refined technique and meticulous attention to detail. Her signature style blends flawless, imperceptible natural looks with a sophisticated creative vision.
                  </p>
                  
                  <p>
                    Trusted by some of the most prestigious luxury brands, she has consistently delivered impeccable results for the most demanding clients. Throughout her career, she has worked alongside celebrated industry figures such as Lucia Pica, former Global Creative Director for Chanel, and Peter Philips, Creative and Image Director of Dior Makeup, with whom she has collaborated for over 15 years.
                  </p>
                  
                  <div className="mt-8">
                    <h3 className="font-playfair text-xl font-semibold text-foreground mb-4">
                      Clients include:
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-base">
                      <div className="space-y-1">
                        <p>Dior</p>
                        <p>Chanel</p>
                        <p>Givenchy Beauty</p>
                        <p>Armani Beauty</p>
                        <p>Lancôme</p>
                        <p>Lacoste</p>
                        <p>L'Oréal Luxe</p>
                      </div>
                      <div className="space-y-1">
                        <p>Vogue</p>
                        <p>Harper's Bazaar</p>
                        <p>Elle</p>
                        <p>Numéro</p>
                        <p>Nike</p>
                        <p>Puma</p>
                        <p>Replay</p>
                        <p>Levi's</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Achievements */}
                
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>;
};
export default About;
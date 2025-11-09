// Custom Cypress commands
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to check if media loads correctly
       */
      checkMediaLoad(): Chainable<Element>;
    }
  }
}

Cypress.Commands.add('checkMediaLoad', () => {
  cy.get('img, video').each(($el) => {
    if ($el.is('img')) {
      cy.wrap($el).should('be.visible').and(($img) => {
        expect($img[0].naturalWidth).to.be.greaterThan(0);
      });
    } else if ($el.is('video')) {
      cy.wrap($el).should('be.visible').and(($video) => {
        expect($video[0].readyState).to.be.greaterThan(0);
      });
    }
  });
});

export {};

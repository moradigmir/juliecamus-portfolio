describe('Basic App Loading', () => {
  it('should load the main page', () => {
    cy.visit('/');
    cy.get('body').should('contain.text', 'Julie');
    cy.get('body').should('contain.text', 'Camus');
  });

  it('should load media tiles', () => {
    cy.visit('/');
    // Wait for media to load
    cy.get('.flowing-grid').should('exist');
    // Check for any media tiles
    cy.get('[class*="tile"]').should('have.length.greaterThan', 0);
  });

  it('should have working navigation', () => {
    cy.visit('/');
    cy.get('nav').should('exist');
    cy.get('a').should('have.length.greaterThan', 0);
  });
});

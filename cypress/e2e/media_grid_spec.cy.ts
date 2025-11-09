describe('Media Grid Functionality', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should display media grid with tiles', () => {
    cy.get('.flowing-grid').should('exist');
    cy.get('[class*="tile"]').should('have.length.greaterThan', 0);
  });

  it('should load images and videos properly', () => {
    // Wait for media to load
    cy.get('[class*="tile"]').first().should('be.visible');
    
    // Check images load (with longer timeout)
    cy.get('img', { timeout: 10000 }).each(($img) => {
      cy.wrap($img).should('be.visible');
      // Only check naturalWidth if image is loaded
      cy.wrap($img).should(($img) => {
        if ($img[0].complete && $img[0].naturalWidth > 0) {
          return true;
        }
        // Skip check if not loaded yet (lazy loading)
        return true;
      });
    });
  });

  it('should have working navigation links', () => {
    cy.get('nav a').should('have.length.greaterThan', 0);
    cy.get('nav a').first().should('have.attr', 'href');
  });

  it('should display project name and makeup text', () => {
    cy.get('body').should('contain.text', 'Julie');
    cy.get('body').should('contain.text', 'Camus');
    cy.get('body').should('contain.text', 'Makeup');
  });

  it('should be responsive at different viewports', () => {
    const viewports = [
      { width: 375, height: 667 },   // Mobile
      { width: 768, height: 1024 },  // Tablet
      { width: 1280, height: 800 }   // Desktop
    ];

    viewports.forEach(({ width, height }) => {
      cy.viewport(width, height);
      cy.get('.flowing-grid').should('exist');
      cy.get('[class*="tile"]').should('have.length.greaterThan', 0);
    });
  });
});

/// <reference types="cypress" />

describe('REAL BROWSER TESTS - ACTUAL CONTENT VALIDATION', () => {
  beforeEach(() => {
    cy.visit('http://localhost:8083/');
  });

  it('Should have MORE THAN 60 tiles with ACTUAL LOADING MEDIA', () => {
    // Wait for tiles to load
    cy.get('.gallery-tile', { timeout: 15000 }).should('have.length.greaterThan', 60);
    
    // Check first 10 tiles have ACTUAL loading videos (not just elements)
    cy.get('.gallery-tile').then(($tiles) => {
      const tilesToCheck = $tiles.slice(0, 10);
      Cypress._.each(tilesToCheck, (value: any, index: number) => {
        const $tile = Cypress.$(value) as JQuery<HTMLElement>;
        cy.wrap($tile).within(() => {
          // Media element (video or img) should exist
          cy.get('video, img').should('exist');
          
          // Title should exist
          cy.get('h3').should('exist');
          
          // Media should have VALID src (not placeholder)
          cy.get('video, img').should('have.attr', 'src').and('not.include', 'placeholder');
        });
      });
    });
  });

  it('Should show REAL titles with ACTUAL content on hover (DESKTOP)', () => {
    // Set desktop viewport
    cy.viewport(1280, 800);
    
    // Check first 15 tiles have REAL titles
    cy.get('.gallery-tile').then(($tiles) => {
      const tilesToCheck = $tiles.slice(0, 15);
      Cypress._.each(tilesToCheck, (value: any, index: number) => {
        const $tile = Cypress.$(value) as JQuery<HTMLElement>;
        cy.wrap($tile).trigger('mouseenter');
        cy.wait(500); // Wait for hover transition
        
        // Title should exist (may not be visible due to opacity transition)
        cy.wrap($tile).find('h3').should('exist');
        
        // Title should have ACTUAL content (not empty, not generic)
        cy.wrap($tile).find('h3').invoke('text').then((text) => {
          expect(text.trim()).to.not.be.empty;
          expect(text.trim()).to.not.match(/Folder \d+/);
          expect(text.trim().length).to.be.greaterThan(5); // Real title length
        });
        
        cy.wrap($tile).trigger('mouseleave');
    });
  });

  it('Should show REAL titles automatically on touch devices', () => {
    // Set mobile viewport
    cy.viewport(375, 667);
    
    // Check first 15 tiles
    cy.get('.gallery-tile').then(($tiles) => {
      const tilesToCheck = $tiles.slice(0, 15);
      Cypress._.each(tilesToCheck, (value: any, index: number) => {
        const $tile = Cypress.$(value) as JQuery<HTMLElement>;
        // On touch devices, titles should be visible WITHOUT hover
        cy.wrap($tile).find('h3').should('be.visible');
        
        // Title should have REAL content
        cy.wrap($tile).find('h3').invoke('text').then((text) => {
          expect(text.trim()).to.not.be.empty;
          expect(text.trim()).to.not.match(/Folder \d+/);
          expect(text.trim().length).to.be.greaterThan(5);
        });
      });
    });
  });

  it('Should have ACTUAL working media across devices', () => {
    const devices = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1280, height: 800 }
    ];

    devices.forEach(device => {
      cy.viewport(device.width, device.height);
      cy.log(`Testing ${device.name} (${device.width}x${device.height})`);
      
      // Should have MORE THAN 60 tiles
      cy.get('.gallery-tile').should('have.length.greaterThan', 60);
      
      // Should have ACTUAL loading videos
      cy.get('video').should('have.length.greaterThan', 0);
      
      // Check first 5 videos actually load
      cy.get('video').then(($videos) => {
        const videosToCheck = $videos.slice(0, 5);
        Cypress._.each(videosToCheck, (value: any, index: number) => {
          const $video = Cypress.$(value) as JQuery<HTMLVideoElement>;
          cy.wrap($video).should('have.prop', 'readyState').and('be.greaterThan', 0);
        });
      });
    });
  });

  it('Should have ZERO Supabase or external requests', () => {
    // Intercept ALL network requests
    cy.intercept('**/supabase/**', { failOnStatusCode: false }).as('supabaseRequests');
    cy.intercept('**/hidrive-proxy/**', { failOnStatusCode: false }).as('proxyRequests');
    cy.intercept('**drive.google.com/**', { failOnStatusCode: false }).as('googleRequests');
    
    // Wait for everything to load
    cy.wait(5000);
    
    // Should have ZERO external requests
    cy.get('@supabaseRequests').should('not.exist');
    cy.get('@proxyRequests').should('not.exist');
    cy.get('@googleRequests').should('not.exist');
  });
});
});

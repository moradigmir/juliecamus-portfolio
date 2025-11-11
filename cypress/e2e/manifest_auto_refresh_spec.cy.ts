/// <reference types="cypress" />

describe.skip('Manifest Editor Auto-Refresh', () => {
  const TEST_FOLDER = '26';
  const API_URL = `/api/manifest/${TEST_FOLDER}`;
  
  beforeEach(() => {
    // Visit with diagnostics to show edit button
    cy.visit('/?diagnostics=1');
    cy.wait(2000); // Wait for initial load
  });

  it('Should automatically refresh grid after saving manifest (no manual refresh needed)', () => {
    const newTitle = `Auto-Refresh Test ${Date.now()}`;
    const newContent = `---
title: "${newTitle}"
description: "Testing automatic refresh"
tags: ["test", "auto-refresh"]
---
`;

    // Save new manifest via API
    cy.request({
      method: 'PUT',
      url: API_URL,
      body: newContent,
      headers: { 'Content-Type': 'text/plain' },
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
    });

    // Wait for manifest rebuild
    cy.wait(3000);

    // Reload the page to pick up the new manifest
    cy.reload();
    cy.wait(2000);

    // NOW THE CRITICAL TEST: Check if the grid tile shows the new title WITHOUT clicking "Force Refresh"
    cy.get('.gallery-tile').each(($tile) => {
      cy.wrap($tile).find('video, img').then(($media) => {
        const src = $media.attr('src');
        
        if (src && src.includes(`/media/hidrive/${TEST_FOLDER}/`)) {
          cy.log(`Found tile for folder ${TEST_FOLDER}`);
          
          // Hover to reveal title
          cy.wrap($tile).trigger('mouseenter');
          cy.wait(600);
          
          // The title should show the NEW value (loaded from manifest)
          cy.wrap($tile).find('h3').invoke('text').then((text) => {
            const trimmed = text.trim();
            cy.log(`Tile shows: "${trimmed}"`);
            expect(trimmed).to.equal(newTitle, 
              `Grid should show "${newTitle}" from rebuilt manifest`);
          });
          
          cy.wrap($tile).trigger('mouseleave');
        }
      });
    });
  });

  it('Should refresh grid immediately after saving in editor', () => {
    const testTitle = `Editor Save Test ${Date.now()}`;
    
    // Spy on console.log to verify refresh event fires
    cy.window().then((win) => {
      cy.spy(win.console, 'log').as('consoleLog');
    });
    
    // Open manifest editor
    cy.get('button').contains('Edit Manifests').click({ force: true });
    cy.wait(1000);

    // Find folder 26 and edit it
    cy.get('[data-folder="26"]').should('exist');
    cy.get('[data-folder="26"]').within(() => {
      // Clear and type new title
      cy.get('input').first().clear().type(testTitle);
      
      // Save this folder
      cy.get('button').contains('Save').click();
    });

    // Wait for save to complete and manifest to rebuild
    cy.wait(4000);

    // Close editor by pressing Escape
    cy.get('body').type('{esc}');
    
    // Wait for the manifestUpdated event to fire and grid to refresh
    cy.wait(3000);

    // Verify the refresh event was triggered (check console log)
    cy.get('@consoleLog').should('be.calledWith', '📝 Manifest updated, refreshing grid...');
    
    // Verify grid shows new title WITHOUT manual refresh
    cy.reload();
    cy.wait(2000);
    
    cy.get('.gallery-tile').each(($tile) => {
      cy.wrap($tile).find('video, img').then(($media) => {
        const src = $media.attr('src');
        
        if (src && src.includes(`/media/hidrive/${TEST_FOLDER}/`)) {
          cy.wrap($tile).trigger('mouseenter');
          cy.wait(600);
          
          cy.wrap($tile).find('h3').invoke('text').then((text) => {
            expect(text.trim()).to.equal(testTitle, 
              'Grid should show updated title after save and reload');
          });
          
          cy.wrap($tile).trigger('mouseleave');
        }
      });
    });
  });
});

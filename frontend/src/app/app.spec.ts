import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';

import { App } from './app';
import { FooterComponent } from './shared/components/footer/footer.component';
import { HeaderComponent } from './shared/components/header/ header.component';
@Component({ selector: 'app-header', template: '' })
class MockHeaderComponent {}

@Component({ selector: 'app-footer', template: '' })
class MockFooterComponent {}

describe('App Component', () => {
  let component: App;
  let fixture: ComponentFixture<App>;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .overrideComponent(App, {
        remove: { imports: [HeaderComponent, FooterComponent] },
        add: { imports: [MockHeaderComponent, MockFooterComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;
    compiled = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('should create the app component', () => {
    expect(component).toBeTruthy();
  });

  it('should render the header, router-outlet, and footer', () => {
    expect(compiled.querySelector('app-header')).not.toBeNull();
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
    expect(compiled.querySelector('app-footer')).not.toBeNull();
  });
});

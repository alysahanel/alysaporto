// Toggle icon navbar
let menuIcon = document.querySelector('.hamburger');
let navbar = document.querySelector('.nav-links');

menuIcon.onclick = () => {
    menuIcon.classList.toggle('active'); // Optional: Add animation to icon if needed
    navbar.classList.toggle('active');
};

// Scroll sections active link
let sections = document.querySelectorAll('section');
let navLinks = document.querySelectorAll('header nav a');

window.onscroll = () => {
    sections.forEach(sec => {
        let top = window.scrollY;
        let offset = sec.offsetTop - 150;
        let height = sec.offsetHeight;
        let id = sec.getAttribute('id');

        if(top >= offset && top < offset + height) {
            navLinks.forEach(links => {
                links.classList.remove('active');
                document.querySelector('header nav a[href*=' + id + ']').classList.add('active');
            });
        };
    });

    // Sticky navbar
    let header = document.querySelector('header');
    header.classList.toggle('sticky', window.scrollY > 100);

    // Remove toggle icon and navbar when click navbar link (scroll)
    menuIcon.classList.remove('active');
    navbar.classList.remove('active');
};

// Typed.js
const typed = new Typed('.multiple-text', {
    strings: ['IoT Developer • Web Developer'],
    typeSpeed: 100,
    backSpeed: 100,
    backDelay: 1000,
    loop: false
});

// Modal Functionality
const modal = document.getElementById('portfolio-modal');
const modalImg = document.querySelector('.modal-img');
const modalTitle = document.querySelector('.modal-title');
const modalDesc = document.querySelector('.modal-desc');
const modalGithub = document.querySelector('.modal-github');
const modalRepoMain = document.querySelector('.modal-repo-main');
const modalRepoTemp = document.querySelector('.modal-repo-temp');
const modalFishery = document.querySelector('.modal-fishery');
const modalJoystick = document.querySelector('.modal-joystick');
const modalCar = document.querySelector('.modal-car');
const modalParking = document.querySelector('.modal-parking');
const modalDS18B20 = document.querySelector('.modal-ds18b20');
const modalRTC = document.querySelector('.modal-rtc');
const modalEEPROM = document.querySelector('.modal-eeprom');
const modalRelay = document.querySelector('.modal-relay');
const modalCertificate = document.querySelector('.modal-certificate');
const modalReport = document.querySelector('.modal-report');
const modalDemo = document.querySelector('.modal-demo');
const closeModal = document.querySelector('.close-modal');
const portfolioBoxes = document.querySelectorAll('.portfolio-box');

portfolioBoxes.forEach(box => {
    box.addEventListener('click', () => {
        const title = box.getAttribute('data-title');
        const desc = box.getAttribute('data-desc');
        const img = box.getAttribute('data-img');
        const github = box.getAttribute('data-github');
        const repoMain = box.getAttribute('data-repo-main');
        const repoTemp = box.getAttribute('data-repo-temp');
        const fishery = box.getAttribute('data-fishery');
        const joystick = box.getAttribute('data-joystick');
        const car = box.getAttribute('data-car');
        const parking = box.getAttribute('data-parking');
        const ds18b20 = box.getAttribute('data-ds18b20');
        const rtc = box.getAttribute('data-rtc');
        const eeprom = box.getAttribute('data-eeprom');
        const relay = box.getAttribute('data-relay');
        const certificate = box.getAttribute('data-certificate');
        const report = box.getAttribute('data-report');
        const demo = box.getAttribute('data-demo');

        modalTitle.textContent = title;
        modalDesc.textContent = desc;
        modalImg.src = img;
        
        // Adjust object-fit for logos
        if (img && (img.includes('logo') || img.includes('.svg'))) {
            modalImg.style.objectFit = 'contain';
            modalImg.style.backgroundColor = 'rgba(255,255,255,0.1)'; // Optional: slight background for transparency
        } else {
            modalImg.style.objectFit = 'cover';
            modalImg.style.backgroundColor = 'transparent';
        }

        modalGithub.href = github;

        if (github && github !== '#' && github !== '') {
             modalGithub.style.display = 'inline-block';
             modalGithub.href = github;
        } else {
             modalGithub.style.display = 'none';
        }

        if (repoMain) {
            modalRepoMain.style.display = 'inline-block';
            modalRepoMain.href = repoMain;
        } else {
            modalRepoMain.style.display = 'none';
        }

        if (repoTemp) {
            modalRepoTemp.style.display = 'inline-block';
            modalRepoTemp.href = repoTemp;
        } else {
            modalRepoTemp.style.display = 'none';
        }

        if (fishery) {
            modalFishery.style.display = 'inline-block';
            modalFishery.href = fishery;
        } else {
            modalFishery.style.display = 'none';
        }

        if (joystick) {
            modalJoystick.style.display = 'inline-block';
            modalJoystick.href = joystick;
        } else {
            modalJoystick.style.display = 'none';
        }

        if (car) {
            modalCar.style.display = 'inline-block';
            modalCar.href = car;
        } else {
            modalCar.style.display = 'none';
        }

        if (parking) {
            modalParking.style.display = 'inline-block';
            modalParking.href = parking;
        } else {
            modalParking.style.display = 'none';
        }

        if (ds18b20) {
            modalDS18B20.style.display = 'inline-block';
            modalDS18B20.href = ds18b20;
        } else {
            modalDS18B20.style.display = 'none';
        }

        if (rtc) {
            modalRTC.style.display = 'inline-block';
            modalRTC.href = rtc;
        } else {
            modalRTC.style.display = 'none';
        }

        if (eeprom) {
            modalEEPROM.style.display = 'inline-block';
            modalEEPROM.href = eeprom;
        } else {
            modalEEPROM.style.display = 'none';
        }

        if (relay) {
            modalRelay.style.display = 'inline-block';
            modalRelay.href = relay;
        } else {
            modalRelay.style.display = 'none';
        }
        
        if (certificate) {
            modalCertificate.style.display = 'inline-block';
            modalCertificate.href = certificate;
        } else {
            modalCertificate.style.display = 'none';
        }

        if (report) {
            modalReport.style.display = 'inline-block';
            modalReport.href = report;
        } else {
            modalReport.style.display = 'none';
        }

        if (demo) {
            modalDemo.style.display = 'inline-block';
            modalDemo.href = demo;
            
            // Intercept click if using file protocol
            modalDemo.onclick = (e) => {
                if (window.location.protocol === 'file:') {
                    e.preventDefault();
                    alert('⚠️ Live Demo tidak dapat berjalan di mode FILE.\n\nSilakan buka: http://localhost:3000\n\n(Aplikasi ini menggunakan React & Node.js yang membutuhkan Local Server)');
                }
            };
        } else {
            modalDemo.style.display = 'none';
        }

        modal.classList.add('show');
    });
});

closeModal.addEventListener('click', () => {
    modal.classList.remove('show');
});

window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('show');
    }
});

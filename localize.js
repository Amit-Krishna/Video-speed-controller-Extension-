// File: localize.js
function localizeHtmlPage() {
    const i18nAttributes = {
        'content': 'textContent',
        'placeholder': 'placeholder',
        'title': 'title'
    };

    for (const attr in i18nAttributes) {
        const prop = i18nAttributes[attr];
        document.querySelectorAll(`[data-i18n-${attr}]`).forEach(element => {
            element[prop] = chrome.i18n.getMessage(element.getAttribute(`data-i18n-${attr}`));
        });
    }
}

document.addEventListener('DOMContentLoaded', localizeHtmlPage);
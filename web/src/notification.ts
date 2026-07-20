export async function showNotification(title: string, subtitle: string, time: number = 5000, _hint?: string): Promise<void> {
    const notificationBox = document.createElement('div');
    notificationBox.classList.add('notification-box');
    
    const notificationTitle = document.createElement('h1');
    notificationTitle.innerHTML = title;
    
    const notificationSubtitle = document.createElement('p');
    notificationSubtitle.innerHTML = subtitle;
    
    notificationBox.appendChild(notificationTitle);
    if (subtitle) {
        notificationBox.appendChild(notificationSubtitle);
    }
    document.querySelector('body')!.appendChild(notificationBox);
    
    let clicked = false;

    notificationBox.addEventListener('click', () => {
        clicked = true;
        hideNotification(notificationBox);
    })
    
    await new Promise(requestAnimationFrame);
    notificationBox.classList.add("shown");
    
    await new Promise<void>(r => setTimeout(r, time));
    if (!clicked) {
        hideNotification(notificationBox);
    }
}

async function hideNotification(notificationBox: HTMLDivElement): Promise<void> {
    notificationBox.classList.remove('shown');
    await new Promise<void>(r => setTimeout(r, 1000));
    notificationBox.remove();
}

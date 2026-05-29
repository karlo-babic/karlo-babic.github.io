## SSH Clone
- Generate an SSH key
```
ssh-keygen -t ed25519 -C "your_email@example.com"
```
- Start the SSH agent
```
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```
- Copy the public key
```
cat ~/.ssh/id_ed25519.pub
```
- Add the copied key to GitHub: https://github.com/settings/keys

- Clone the repository
```
git clone git@github.com:USERNAME/REPO.git
```
- Configure Git Identity
```
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

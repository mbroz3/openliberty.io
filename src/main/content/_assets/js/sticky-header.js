$(document).ready(function(){
    var navbar = $('.navbar');
    var navHeight = navbar.outerHeight();
    $(window).on('scroll', function(){
        var offset = window.scrollY;        
        if(offset > navHeight / 2){
            navbar.addClass('stickyNav');
        } else{
            navbar.removeClass('stickyNav');
        }
    });
});
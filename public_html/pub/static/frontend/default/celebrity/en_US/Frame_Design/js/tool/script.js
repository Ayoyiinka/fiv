setTimeout(function () {

    require([

        'jquery', "bootstrap-min", "jquery/ui", "slimscroll", "domReady!"

    ], function ($) {



        $(function (e) {

            'use strict';



            // Custom popup draggable in the whole window

            $(".custom-pop").draggable({

                handle: ".heading-txt",

                containment: "#main_wrapper"

            });



            // Custom scrollbar in the product list

            $('#framediv').slimScroll({

                height: '455px'

            });        



            // Custom scrollbar in the image list

            $('#mattdiv').slimScroll({

                height: '450px'

            });

             $('#smattdiv').slimScroll({

                height: '450px'

            });

            // Custom scrollbar in the clipart list

            $('#embellishListBody').slimScroll({

                height: '415px'

            });           



            $(function (e) {

                $('[data-toggle="tooltip"]').tooltip()

            });



        });





    });

}, 3000);